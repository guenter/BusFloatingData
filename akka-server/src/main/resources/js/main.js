var self = this;


self.getWebsocket = function() {
    var path = "ws://localhost:8000/ws/vehicles/boundingBox?bbox=";
//    path += bbox;
    return new WebSocket(path);
};

var center = new ol.Feature({
geometry: new ol.geom.Point(ol.proj.fromLonLat([-118.23194,34.12527]))
});

center.setStyle(new ol.style.Style({
image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
  color: '#8959A8',
  src: 'data/dot.png'
}))
}));


var vectorSource = new ol.source.Vector({
features: [center]
});

var vectorLayer = new ol.layer.Vector({
source: vectorSource
});

self.vehicleSource = new ol.source.Vector();

var vehicleLayer = new ol.layer.Vector({
source: self.vehicleSource
});

self.routesSource = new ol.source.Vector();
var routeLayer = new ol.layer.Vector({
source: self.routesSource
});

var rasterLayer = new ol.layer.Tile({
source: new ol.source.OSM()
});


var map = new ol.Map({
controls: ol.control.defaults().extend([
  new ol.control.OverviewMap()
]),
target: 'map',
layers: [rasterLayer, vectorLayer, vehicleLayer, routeLayer],
view: new ol.View({
  projection: ol.proj.get('EPSG:3857'),
  center: ol.proj.fromLonLat([-118.23194,34.12527]),
  zoom: 14
})
});

self.akkaServiceBasis = 'http://localhost:8000/vehicles/boundingBox?bbox='
self.akkaRouteInfoService = 'http://localhost:8000/routeInfo/'
self.akkaRouteService = 'http://localhost:8000/route/'

self.ajax = function(uri) {
  var request = {
      url: uri,
      type: 'GET',
      contentType: "application/json",
      accepts: "application/json",

      cache: false,
      dataType: 'json',
      error: function(jqXHR) {
          console.log("ajax error " + jqXHR.status);
      }
  };
  return $.ajax(request);
};


self.sessionStyle = {};

//self.socket = self.getWebsocket();
//
//self.socket.onmessage = function (msg) {
//  console.log("got websocket response")
////  var data = JSON.parse(msg.data);
////  console.log("got websocket data: " + data);
//  self.drawDataOnMap(msg.data);
//}

self.drawDataOnMap = function(data) {
   console.log("requested data");
   if (self.vehicleSource.getFeatures().length > 0) {
     console.log("cleared vehicleSource");
     self.vehicleSource.clear();
   }

   for (var i = 0; i < data.length; i++) {
       var field = data[i];
       console.log("createing feature for data: "+field.id);
       var feature = new ol.Feature(field);

       var latitude = field.latitude;
       var longitude = field.longitude;
       var point = new ol.geom.Point(ol.proj.fromLonLat([longitude,latitude]));

       var colorStyle;

       if (self.sessionStyle.hasOwnProperty(field.id)) {
         colorStyle = sessionStyle[field.id]
       } else {
         colorStyle = self.pickColor()
         self.sessionStyle[field.id] = colorStyle;
       }

       style = new ol.style.Style({
             image: new ol.style.Icon(/** @type {olx.style.IconOptions} */ ({
             color: colorStyle,
             src: 'data/arrow.png',
             rotation: field.heading
             }))
         });

       feature.setGeometry(point)
       feature.setStyle(style)

       self.vehicleSource.addFeature(feature);
   }

   console.log("feature updated");
}

self.map.on('moveend', function (event) {
  console.log("map move end");

  var mapExtent = self.map.getView().calculateExtent(map.getSize());
  var bottomRight = ol.extent.getBottomRight(mapExtent);
  var topLeft = ol.extent.getTopLeft(mapExtent);
  var brLonLat = ol.proj.toLonLat(bottomRight);
  var tlLonLat = ol.proj.toLonLat(topLeft);

  self.akkaService = self.akkaServiceBasis+tlLonLat[1]+","+tlLonLat[0]+","+brLonLat[1]+","+brLonLat[0];

//  var socket = self.getWebsocket();
//
//  socket.onmessage = function (msg) {
//      console.log("got websocket response")
//      self.drawDataOnMap(msg.data);
//  }
//
//  socket.send(tlLonLat[1]+","+tlLonLat[0]+","+brLonLat[1]+","+brLonLat[0])

  self.ajax(self.akkaService).done(function(data){
    console.log("got data")
    self.drawDataOnMap(data);
  });
});

self.drawRoutes = function(routeIds) {
    if(self.routesSource.getFeatures().length > 0) {
        console.log("clear old routes")
        self.routesSource.clear();
    }
    for (var i = 0, ii = routeIds.length; i < ii; ++i) {
        var requestUrl = self.akkaRouteService+routeIds[i];
        self.ajax(requestUrl).done(function(data){

            if (data.length == 0)
                return;

            var feature = new ol.Feature(data[i])
            var lineString = new ol.geom.LineString();
            for (var i = 0; i < data.length; i++) {
                var latitude = data[i].latitude;
                var longitude = data[i].longitude;
                var coord = ol.proj.fromLonLat([longitude,latitude]);
                lineString.appendCoordinate(coord);
            }
            feature.setGeometry(lineString)

            feature.setStyle(new ol.style.Style({
                fill: new ol.style.Fill({
                    color: 'rgba(255, 255, 255, 0.2)',
                    weight: 4
                }),
                stroke: new ol.style.Stroke({
                    color: '#808080',
                    width: 4
                })
              }));

            self.routesSource.addFeature(feature);
        });
    }
}

self.createOverlay = function() {
    return new ol.Overlay({
        element: document.getElementById('myOverlay'),
        positioning: 'top-right',
        stopEvent: false,
        insertFirst: false
    });
}

self.queryRoutes = function(routeIds) {
    for (var i = 0, ii = routeIds.length; i < ii; ++i) {
        var requestUrl = self.akkaRouteInfoService+routeIds[i];
        $('#coordinate').text();
        self.ajax(requestUrl).done(function(data){
            data[0].display_name
            var txt = "<li>" + data[0].display_name + "</li>";
            $('#routeInfos').append(txt)
        });
    }

}

self.setCoordinateAndShow = function(coordinate, pixel) {
    $(overlay.getElement()).hide();
    $('#routeInfos').empty();
    // Set position
    overlay.setPosition(coordinate);

    var features = [];
    self.map.forEachFeatureAtPixel(pixel, function(feature, layer) {
      features.push(feature);
    });

    if (features.length > 0) {
      var info = [];
      var uniqueIds = [];


      for (var i = 0, ii = features.length; i < ii; ++i) {
        var routeId = features[i].get('route_id');

        if (typeof routeId != 'undefined' && $.inArray(routeId, uniqueIds) == -1) {
            uniqueIds.push(routeId);
        }

        info.push(features[i].get('id'));
        //maybe it's a lineString
        console.log("Geom is: " + features[i].getGeometry());
        if (typeof features[i].getGeometry == 'ol.geom.LineString') {
            console.log("found a linestring");
            var closestPoint = features[i].getClosestPoint(coordinate);
            console.log("now query backend for route with closest point");
        }
      }
      if (uniqueIds.length > 0) {
        self.queryRoutes(uniqueIds);
        self.drawRoutes(uniqueIds);
      }


      $('#coordinate').text(info.join(', ') || '(unknown)');
      $(overlay.getElement()).show();
    }
}

self.overlay = createOverlay();

console.log("created overlay: "+self.overlay);

self.map.addOverlay(self.overlay);

self.map.on('click', function(event) {
    var coordinate = event.coordinate;
    var pixel = event.pixel;
    setCoordinateAndShow(coordinate, pixel);
});


self.pickColor = function() {
return "#000000".replace(/0/g,function(){return (~~(Math.random()*16)).toString(16);});
};
