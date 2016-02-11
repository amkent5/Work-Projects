$(document).ready( function(){

// create table object and headers
var table = document.createElement('table');
var row1 = table.insertRow(0);
row1.insertCell(0).innerHTML = '<b>dateTime</b>'
row1.insertCell(1).innerHTML = '<b>unixTs (s)</b>'
row1.insertCell(2).innerHTML = '<b>jobEvent</b>'
row1.insertCell(3).innerHTML = '<b>operative</b>'
row1.insertCell(4).innerHTML = '<b>jobId</b>'
row1.insertCell(5).innerHTML = '<b>siteJobLinkedTo</b>'
row1.insertCell(6).innerHTML = '<b>longLatsOfSite</b>'
row1.insertCell(7).innerHTML = '<b>longLatsGPS</b>'
row1.insertCell(8).innerHTML = '<b>distanceVariance (km)</b>';

// main
var geocoder = new google.maps.Geocoder();
var map = new google.maps.Map(document.getElementById('map'), {
    zoom: 7,
    center: {lat: 50.7184, lng: -3.5339},
});

// draw new marker on map
function drawMarker(lat, lng, iconURL) {

    var marker = new google.maps.Marker({
        position: new google.maps.LatLng(lat, lng),
        animation: google.maps.Animation.DROP,
        icon: iconURL
    });
    
    marker.setMap(map);
}

// write new data row to table
function writeToTable(dateTime, unixTs, jobEvent, operative, jobId, siteJobLinkedTo, longLatsOfSite, longLatsGPS, distanceVariance, table) {
    var unixTsStr = unixTs.toString();
    var siteCoordsStr = longLatsOfSite.toString();
    var distanceVarianceStr = distanceVariance.toString();
    var rowCount = table.rows.length;
    var row = table.insertRow(rowCount);
    
    row.insertCell(0).innerHTML = dateTime;
    row.insertCell(1).innerHTML = unixTsStr;
    row.insertCell(2).innerHTML = jobEvent;
    row.insertCell(3).innerHTML = operative;
    row.insertCell(4).innerHTML = jobId;
    row.insertCell(5).innerHTML = siteJobLinkedTo;
    row.insertCell(6).innerHTML = siteCoordsStr;
    row.insertCell(7).innerHTML = longLatsGPS;
    row.insertCell(8).innerHTML = distanceVariance;
}

// calculate distance between geocoordinates (Haversine formula)
function toRad(Value) {
    // converts numeric degrees to radians
    return Value * Math.PI/ 180.0;
}
function calcDistance(lat1, lng1, lat2, lng2) {
    var R = 6371.0;     // radius of Earth (km)
    var dLat = toRad(lat2 - lat1);
    var dLng = toRad(lng2 - lng1);
    var a = Math.sin(dLat/2) * Math.sin(dLat/2) + 
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
            Math.sin(dLng/2) * Math.sin(dLng/2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    var d = R * c;
    return d;
}

// geocode function with embedded call to write data to table and map
function codeAddress(this_address, objVarJSON, objVarGPS) {

    var gpsLat = objVarGPS.latitude;
    var gpsLng = objVarGPS.longitude;
    var dist;
    console.log(objVarGPS);

    geocoder.geocode({ 'address': this_address}, function(results, status) {
        if (status == google.maps.GeocoderStatus.OK) {
        
            // call calcDistance here and write result
            dist = (calcDistance(results[0].geometry.location.lat(), results[0].geometry.location.lng(), gpsLat, gpsLng)).toFixed(2);
        
            // draw site location markers
            drawMarker(results[0].geometry.location.lat(), results[0].geometry.location.lng(), 'http://maps.google.com/mapfiles/ms/icons/red-dot.png');

            // draw GPS location markers
            drawMarker(gpsLat, gpsLng, 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png');

            writeToTable(objVarJSON.DateTime, objVarJSON.unixTs, objVarJSON.JobEvent, objVarJSON.Operative, objVarJSON.JobId, 
                results[0].formatted_address, results[0].geometry.location, '(' + gpsLat + ', ' + gpsLng + ')', dist, table);
        }
        else {
            writeToTable(objVarJSON.DateTime, objVarJSON.unixTs, objVarJSON.JobEvent, objVarJSON.Operative, objVarJSON.JobId, 
                objVarJSON.SiteJobLinkedTo, status, '(' + gpsLat + ', ' + gpsLng + ')', dist, table);
        }
    });
}

// access GPS data from table (cant seem to access it as a GET call attribute to the includeScript element - logi studio bug)
// and store as multidimensional associative array
var gpsObj = {};
$('#dtGETResults tbody tr').each(function( index ) {
    var tdTimeStampContent = $('#timeStamp_Row' + index + ' span').html();
    var tdLongitudeContent = $('#longitude_Row' + index + ' span').html();
    var tdLatitudeContent = $('#latitude_Row' + index + ' span').html();
    
    // continue over first row of headers
    if (index == 0) {
        return true;
    }
    
    gpsObj[index -1] = {};
    gpsObj[index -1]["timestamp"] = Math.round(tdTimeStampContent/ 1000);
    gpsObj[index -1]["longitude"] = tdLongitudeContent;
    gpsObj[index -1]["latitude"] = tdLatitudeContent;
    
});

// create "no match" element of gpsObj to use
gpsObj[-1] = {};
gpsObj[-1]["timestamp"] = -1;
gpsObj[-1]["longitude"] = 'No Match';
gpsObj[-1]["latitude"] = 'No Match';
 
// store length of gpsObj -1
var lenGpsObj = 0;
for (var key in gpsObj) {
    ++lenGpsObj;
};
lenGpsObj = lenGpsObj -1;

// data
console.log('Length of varJSON: ' + varJSON.length);
console.log('Length of gpsObj: ' + lenGpsObj);
console.log(gpsObj);
console.log(gpsObj[0].timestamp);
console.log(gpsObj[5].latitude);

// getting OVER_QUERY_LIMIT error status because exceeding the maximum calls per second - attempt at a delay per call:
var i = 0;
function loopData () {
    
    setTimeout(function () {
        
        var gpsMatch;
        
        // here check gpsObj for the match on varJSON[i].unixTsMS and pass into codeAddress
        for (j = 0; j < lenGpsObj; j++) {
            
            // use tolerance of 5mins
            //if (varJSON[i].unixTs - gpsObj[j].timestamp < 300 && varJSON[i].unixTs - gpsObj[j].timestamp > -300) {
            if (varJSON[i].unixTs - gpsObj[j].timestamp < 60000000 && varJSON[i].unixTs - gpsObj[j].timestamp > -60000000) {
                gpsMatch = gpsObj[j];
                console.log(gpsMatch);
                break;
            }
        };

        // if there has been no match set the attributes of gpsMatch to our "no match" version
        if (typeof gpsMatch == 'undefined') {
            gpsMatch = gpsObj[-1];
        }
        else {
            console.log('Found data match');
        }
        
        codeAddress(varJSON[i].SiteJobLinkedTo, varJSON[i], gpsMatch);
        i++;
        
        if (i < varJSON.length) {
            loopData();
        }
        
    }, 600)

}
    
// call loop function
loopData();

// append Table into div
var div = document.getElementById('divTable');
div.appendChild(table);

});