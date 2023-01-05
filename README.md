# General

This project is the first project of 1st semester (2022-2023) course **Full Stack Web Development** of the postgraduate program **_Informatics and Telematics_** of **Harokopio University**.

It simulates a real time display of points on a map as a heatmap. The points are the output of the _[Trilateration](https://handwiki.org/wiki/Trilateration)_ algorithm.

We use plain javascript as well as [heatmapjs](https://www.patrick-wied.at/static/heatmapjs/) along with [Leaflet Heatmap Layer Plugin](https://www.patrick-wied.at/static/heatmapjs/plugin-leaflet-layer.html) for displaying the heatmap.

# Scenario

The points represent the mobile devices of the visitors of [DAS FEST](https://www.dasfest.de/) music festival that took place in 2018 in Günther-Klotz-Anlage park in Karlsruhe, Germany.

# The process

The points are located with 23 Raspberry Pis (RPI) that can be found on `http://62.217.127.19:8080/rpi` and are of the below form:

```Javascript
[
    {"Name":"raspberrypi-1","Latitude":48.99862,"Longitude":8.37519},
    {"Name":"raspberrypi-2","Latitude":48.99854,"Longitude":8.37502},
    ...
]
```

The measurements of the RPIs for the mobile devices are sent every about 20 seconds through a socket from `ws://62.217.127.19:8080/stream` in the form:

```Javascript
[
    {"device_id":"f2:79:60:2d:95:20","measurements":[
            {"rpi":1,"signal_strength":-87,"timestamp":1532123636},
            {"rpi":9,"signal_strength":-75,"timestamp":1532123644},
            {"rpi":10,"signal_strength":-75,"timestamp":1532123647},
            {"rpi":8,"signal_strength":-80,"timestamp":1532123650},
            ...
        ]
    },
    ...
]
```

For each mobile _device_id_ we use the data of 3 RPIs as input to the Trilateration algorithm and the output is sent to the map.

Every 20 seconds that we receive data from the socket, the map displays the points that were located in the last 5 minutes, which are kept by the application in a buffer.

# The Heatmap

<p align="center"><img src="https://github.com/akotronis/DIT170-1/blob/master/resources/map.gif" alt="Heatmap" width="500"/></p>

<!-- ![](https://github.com/akotronis/DIT170-1/blob/master/resources/map.gif) -->
