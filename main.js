"use strict";
// import sample_data from "./Sample-Data.json" assert { type: "json" };

const rpisEndpoint = "http://62.217.127.19:8080/rpi";
const dataEndpoint = "ws://62.217.127.19:8080/stream";
const measuredPower = -44;
const n = 2.4;
const minsBuffer = 5;
const cfg = {
  // radius should be small ONLY if scaleRadius is true (or small radius is intended)
  // if scaleRadius is false it will be the constant radius used in pixels
  radius: 0.00009,
  maxOpacity: 0.5,
  // scales the radius based on map zoom
  scaleRadius: true,
  // if set to false the heatmap uses the global maximum for colorization
  // if activated: uses the data maximum within the current map boundaries
  //   (there will always be a red spot with useLocalExtremas true)
  useLocalExtrema: true,
  // which field name in your data represents the latitude - default "lat"
  latField: "lat",
  // which field name in your data represents the longitude - default "lng"
  lngField: "lon",
  // which field name in your data represents the data value - default "value"
  valueField: "value",
};

const heatmapLayer = new HeatmapOverlay(cfg);

const baseLayer = L.tileLayer(
  "http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    attribution: "...",
    maxZoom: 30,
  }
);

const map = new L.Map("map", {
  // Günther-Klotz-Anlage park where Das Fest 2018 took place
  center: new L.LatLng(48.9983791, 8.3750219),
  zoom: 17,
  layers: [baseLayer, heatmapLayer],
});

////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////

window.addEventListener("load", (e) => {
  // Fetch rpisData object and when fetched, proceed with further actions
  fetchRpis().then((rpisData) => {
    // Transform rpis
    rpisData = formatRpis(rpisData);

    // Add toggle rpis button
    const toggleBtn = addToggleBtn();

    // Add rpis markers to map
    let rpisMarkers = toggleRpisOnMap(map, rpisData, []);

    // Add event listener for the toggle button
    toggleBtn.addEventListener("click", (e) => {
      rpisMarkers = toggleRpisOnMap(map, rpisData, rpisMarkers);
    });

    // Create Web Socket
    const ws = new WebSocket(dataEndpoint);
    // Add open, close, error event listeners
    ws.addEventListener("open", (event) => {
      console.log(`Opend connection with ${dataEndpoint}`);
    });
    ws.addEventListener("close", (event) => {
      console.log(`Closed connection with ${dataEndpoint}`);
    });
    ws.addEventListener("error", (event) => {
      console.log(`WebSocket error: ${event}.`);
    });

    // Here we keep the data of tha last (minsBuffer) minutes data, assuming data are reveived every approximately 20secs (3 times in a minute)
    let devicesData = [];
    // Count the number of times we receive data
    let _20secsCounter = 0;
    // Add message event listener
    ws.addEventListener("message", (event) => {
      _20secsCounter += 1;

      const currentDataNum = devicesData.length;
      const receivedData = JSON.parse(event.data);
      // Update last (minsBuffer) minutes data
      if (_20secsCounter < 3 * minsBuffer) {
        devicesData = handleData(devicesData, receivedData);
      } else {
        devicesData = handleData(devicesData, receivedData, true);
      }

      // Output a report in console on device data handling
      console.log(
        `Current devices: ${currentDataNum} Received: ${receivedData.length}, Updated: ${devicesData.length}`
      );

      // Devices that we managed to locate by trilateration
      let devicesLocations = [];
      for (const deviceData of devicesData) {
        const deviceLatLon = locateDevice(
          deviceData,
          measuredPower,
          n,
          rpisData
        );
        if (deviceLatLon != undefined) {
          const point_trf = transformForHeatmap(deviceLatLon);
          devicesLocations.push(point_trf);
        }
      }
      // Output a report in console on located devices
      console.log(
        `Total devices (last ${minsBuffer}m): ${devicesData.length} Located: ${
          devicesLocations.length
        } (${
          devicesData.length > 0
            ? ((100 * devicesLocations.length) / devicesData.length).toFixed(2)
            : 0
        }%)`
      );

      const heatmapData = {
        max: 10000,
        data: devicesLocations,
      };
      heatmapLayer.setData(heatmapData);
    });
  });
});
