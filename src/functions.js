function* combinations(array, k, n = array.length) {
  // https://stackoverflow.com/questions/44091142/combinations-of-n-words-from-array-of-m-words-javascript
  if (k < 1) {
    yield [];
  } else {
    for (let i = --k; i < n; i++) {
      for (let combination of combinations(array, k, i)) {
        combination.push(array[i]);
        yield combination;
      }
    }
  }
}

async function fetchRpis() {
  try {
    const response = await fetch(rpisEndpoint);
    return await response.json();
  } catch (e) {
    alert("Unable to fetch rpis");
  }
}

function formatRpis(rpisData) {
  // Transform rpis from initial form to the form { 1:{ lat:lat, lon:lon }, ... } where
  // keys come from the Name attribute of the initial form
  const rpisData_trf = {};
  for (const rpi of rpisData) {
    const rpiId = parseInt(rpi["Name"].split("-")[1]);
    const lat = rpi["Latitude"];
    const lon = rpi["Longitude"];
    rpisData_trf[rpiId] = { lat: lat, lon: lon };
  }
  return rpisData_trf;
}

function addToggleBtn() {
  // Add button to hide/show rpi markers
  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggle-rpis";
  const buttonContainer = document.getElementById("button-container");
  buttonContainer.appendChild(toggleBtn);
  return toggleBtn;
}

function toggleRpisOnMap(map, rpisData, rpisMarkers) {
  // If rpisMarkers is empty, create markers, add them to map and return them
  // If not empty, remove them from map and return empty array
  // Also modifies the show/hide rpi markers button text
  const toggleBtn = document.getElementById("toggle-rpis");
  const newRpisMarkers = [];
  if (rpisMarkers.length === 0) {
    for (const rpi in rpisData) {
      const { lat, lon } = rpisData[rpi];
      const marker = L.marker([lat, lon]);
      marker.bindPopup(`rpi ${rpi}: (${lat}, ${lon})`);
      // marker.addTo(map);
      map.addLayer(marker);
      newRpisMarkers.push(marker);
      toggleBtn.innerText = "Hide rpi Markers";
    }
  } else {
    for (const rpiMarker of rpisMarkers) {
      map.removeLayer(rpiMarker);
    }
    toggleBtn.innerText = "Show rpi Markers";
  }
  return newRpisMarkers;
}

function locateDevice(deviceData, measuredPower, n, rpisData) {
  // Loop over all the 3-combinations of rpi measurements and if we manage to locate a device by trilateration we return the location
  // If no combination gives trilateration result, undefined will be returned
  for (const comb3 of combinations(deviceData["measurements"], 3)) {
    // 1st rpi
    const rpi1Id = comb3[0]["rpi"];
    const { lat: p1Lat, lon: p1Lon } = rpisData[rpi1Id];
    const p1Rssi = comb3[0]["signal_strength"];
    const r1 = rssiToDistance(p1Rssi, measuredPower, n);
    // 2nd rpi
    const rpi2Id = comb3[1]["rpi"];
    const { lat: p2Lat, lon: p2Lon } = rpisData[rpi2Id];
    const p2Rssi = comb3[1]["signal_strength"];
    const r2 = rssiToDistance(p2Rssi, measuredPower, n);
    // 3rd rpi
    const rpi3Id = comb3[2]["rpi"];
    const { lat: p3Lat, lon: p3Lon } = rpisData[rpi3Id];
    const p3Rssi = comb3[2]["signal_strength"];
    const r3 = rssiToDistance(p3Rssi, measuredPower, n);

    const p1 = latLonToCoords(p1Lat, p1Lon);
    const p2 = latLonToCoords(p2Lat, p2Lon);
    const p3 = latLonToCoords(p3Lat, p3Lon);

    const points = trilateration(p1, p2, p3, r1, r2, r3);
    if (points != undefined) {
      const [x, y, z] = points["p1"];
      const { lat, lon } = coordsToLatLon(x, y, z);
      return { lat: lat, lon: lon };
    }
  }
}

function handleData(data, newData, replace = false) {
  // data = current data, newData = data received by the feeder.
  // If replace=false we just append received data to current
  // If replace=true and received data are at least as current we replace current, else
  // we remove as many from current start and append received to current end
  if (replace === false) {
    data.push(...newData);
  } else {
    if (newData.length < data.length) {
      data = data.slice(newData.length, data.length + 1);
      data.push(...newData);
    } else {
      data = newData;
    }
  }
  return data;
}

function rssiToDistance(rssi, measuredPower, n) {
  // Signal strength to distance in kilometers
  return 10 ** ((measuredPower - rssi) / (10 * n)) / 1000;
}

function latLonToCoords(lat, lon) {
  // https://stackoverflow.com/questions/1185408/converting-from-longitude-latitude-to-cartesian-coordinates
  // Return Cartesian xyz coordiantes in kilometers
  // Approximate earth's radius in kilometers
  const R = 6371;
  const lat_rad = (lat * Math.PI) / 180;
  const lon_rad = (lon * Math.PI) / 180;
  const x = R * Math.cos(lat_rad) * Math.cos(lon_rad);
  const y = R * Math.cos(lat_rad) * Math.sin(lon_rad);
  const z = R * Math.sin(lat_rad);
  return { x: x, y: y, z: z };
}

function coordsToLatLon(x, y, z) {
  // Convert Cartesian xyz coordinates to lat lon
  // Approximate earth's radius in kilometers
  const R = 6371;
  const lat = (180 / Math.PI) * Math.asin(z / R);
  const lon = (180 / Math.PI) * Math.atan2(y, x);
  return { lat: lat, lon: lon };
}

function trilateration(p1, p2, p3, r1, r2, r3) {
  // https://handwiki.org/wiki/Trilateration
  // https://gis.stackexchange.com/questions/66/trilateration-using-3-latitude-longitude-points-and-3-distances
  // pi's of the form { x: x, y: y, z: z }
  // ri's floats
  // If no intersection, undefined is returned, else we return one of the solution(s)
  const { x: x1, y: y1, z: z1 } = p1;
  const { x: x2, y: y2, z: z2 } = p2;
  const { x: x3, y: y3, z: z3 } = p3;

  // Vector P2-P1
  const [p2p1X, p2p1Y, p2p1Z] = [x2 - x1, y2 - y1, z2 - z1];

  // Vector e_x
  const p2p1Norm = Math.sqrt(p2p1X ** 2 + p2p1Y ** 2 + p2p1Z ** 2);
  const [exX, exY, exZ] = [
    p2p1X / p2p1Norm,
    p2p1Y / p2p1Norm,
    p2p1Z / p2p1Norm,
  ];

  // Vector P3-P1
  const [p3p1X, p3p1Y, p3p1Z] = [x3 - x1, y3 - y1, z3 - z1];
  // Dot product i: e_x * (P3-P1)
  const i = exX * p3p1X + exY * p3p1Y + exZ * p3p1Z;
  const [p3p1iexX, p3p1iexY, p3p1iexZ] = [
    p3p1X - i * exX,
    p3p1Y - i * exY,
    p3p1Z - i * exZ,
  ];
  // Vector e_y
  const p3p1iexNorm = Math.sqrt(p3p1iexX ** 2 + p3p1iexY ** 2 + p3p1iexZ ** 2);
  const [eyX, eyY, eyZ] = [
    p3p1iexX / p3p1iexNorm,
    p3p1iexY / p3p1iexNorm,
    p3p1iexZ / p3p1iexNorm,
  ];

  // Vector e_z: cross(e_x, e_y)
  // Definition: For A = [a1, a2, a3] and B = [b1, b2, b3]:
  // cross(A, B) = [a2*b3 - a3*b2, a3*b1 - a1*b3, a1*b2 - a2*b1]
  const [ezX, ezY, ezZ] = [
    exY * eyZ - exZ * eyY,
    exZ * eyX - exX * eyZ,
    exX * eyY - exY * eyX,
  ];

  const d = p2p1Norm;
  const j = eyX * p3p1X + eyY * p3p1Y + eyZ * p3p1Z;
  const x = (r1 ** 2 - r2 ** 2 + d ** 2) / (2 * d);
  const y = (r1 ** 2 - r3 ** 2 + i ** 2 + j ** 2) / (2 * j) - x * (i / j);
  const zSquare = r1 ** 2 - x ** 2 - y ** 2;

  if (zSquare < 0) {
    return undefined;
  }

  const z = Math.sqrt(zSquare);

  const pointA = [
    x1 + x * exX + y * eyX + z * ezX,
    y1 + x * exY + y * eyY + z * ezY,
    z1 + x * exZ + y * eyZ + z * ezZ,
  ];
  const pointB = [
    x1 + x * exX + y * eyX - z * ezX,
    y1 + x * exY + y * eyY - z * ezY,
    z1 + x * exZ + y * eyZ - z * ezZ,
  ];

  return { p1: pointA, p2: pointB };
}

function transformForHeatmap(point) {
  // Transfom a point { lat:lat, lon:lon } to the the format required by heatmap
  const point_trf = { lat: point["lat"], lon: point["lon"], value: 5 };
  return point_trf;
}
