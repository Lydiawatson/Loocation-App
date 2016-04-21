function runApp() {
    "use strict";
    initMap();

    function initMap() {
        //set up some elements as variables
        var confirmLocButton = document.getElementById('confirmButton');

        var geoLocationWorks;

        //set up the map and give it a fallback center
        var map = new google.maps.Map(document.getElementById('map'), {
            center: {lat: -36.86803405818809, lng: 174.75977897644043},
            zoom: 15,
            //disable default controls and properties of the map
            streetViewControl: false,
            mapTypeControl: false,
            zoomControl: false,
            disableDoubleClickZoom: true
        });

        //set up the marker
        var marker = new google.maps.Marker({
            map: map
        });

        //recenter the map on the user's position if possible
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                geoLocationWorks = true;
                var initialLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                map.setCenter(initialLocation);
                allowMarkerEditing(map, marker, confirmLocButton, geoLocationWorks);

            });
        }
        console.log(geoLocationWorks);

        //allow the marker the be added to the map with any of the four methods of click, drag, search, or use user's location
        allowMarkerEditing(map, marker, confirmLocButton, geoLocationWorks);


        //when cancel button is clicked return to home page
        document.getElementById('uploadCancel').onclick = endUpload;
    }


    //function to return the user to the homepage of the app
    function endUpload() {
        window.open('index.html', '_self');
    }

    //function to allow the editing/addition of the marker to the map
    function allowMarkerEditing(map, marker, confirmLocButton, geoLocationWorks) {
        console.log(geoLocationWorks);
        var input = document.getElementById('searchInput');
        marker.setDraggable(true);
        map.setOptions({draggable: true});

        //set marker position by click
        map.addListener('click', function (e) {
            marker.setPosition({lat: e.latLng.lat(), lng: e.latLng.lng()});
            markerPositionChanged(marker.position, confirmLocButton);
        });

        //set marker position when dragged
        marker.addListener('dragend', function (event) {
            //!currently this is giving me the non-updated position, fix this bug at some point

            markerPositionChanged(marker.position, confirmLocButton);
        });

        //set marker position by autocomplete in the search bar (using google's autocomplete service)
        input.disabled = false;
        input.style.display = 'block';
        var autocomplete = new google.maps.places.Autocomplete(input);
        autocomplete.addListener('place_changed', function () {
            var place = autocomplete.getPlace().geometry.location;
            map.setCenter(place);
            marker.setPosition(place);
            markerPositionChanged(marker.position, confirmLocButton);
        });

        //set marker position by user's location if available
        if (geoLocationWorks) {

            var myLocation = document.getElementById('myLoc');
            myLocation.style.display = 'block';
            myLocation.onclick = function () {
                navigator.geolocation.getCurrentPosition(function (position) {
                    var location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    marker.setPosition(location);
                    map.setCenter(location);
                    markerPositionChanged(marker.position, confirmLocButton);
                });
            };
        }

        //when the confirm button is clicked, open the details form
        confirmLocButton.onclick = function () {confirmMarker(map, marker, input, confirmLocButton, geoLocationWorks); };
    }

    //function that runs when marker position is changed
    function markerPositionChanged(markerPos, confirmLocButton) {
        findAddress(markerPos);
        if (confirmLocButton.style.display != 'block') {
            confirmLocButton.style.display = 'block';
            document.getElementById('uploadHeading').innerHTML = 'Confirm marker position or modify';
        }
    }

    //function to work out the formatted address of the marker
    function findAddress(markerPos) {
    //    var markerPos = {lat: markerPosLat, lng: markerPosLng};
        //find the address using google's Geocoder service
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({'location': markerPos}, function (results, status) {
            //gives full address:
            if (status === google.maps.GeocoderStatus.OK) {
                //changes the pop-up window's content so that it displays the address
                document.getElementById("address").innerHTML = results[0].formatted_address;
            }
        });
    }

    //function to open the pop-up window for finishing the upload and to prevent further editing of the marker
    function confirmMarker(map, marker, input, confirmLocButton, geoLocationWorks) {
        //turn off all methods of editing or adding the marker
        marker.setDraggable(false);
        map.setOptions({draggable: false});
        google.maps.event.clearListeners(map, 'click');
        input.disabled = true;
        input.style.display = 'none';
        if (geoLocationWorks) {
            document.getElementById('myLoc').style.display = 'none';   
        }


        //open the pop up and hide the confirm button
        document.getElementById('popUpUpload').style.display = 'block';
        document.getElementById('dimmer').style.display = 'block';
        confirmLocButton.style.display = 'none';
        document.getElementById('uploadHeading').innerHTML = "Now enter the details...";

        //run functions when elements are clicked
        document.getElementById('detailsCancel').onclick = function () {unConfirmMarker(map, marker, confirmLocButton, geoLocationWorks); };
        document.getElementById('doneUpload').onclick = function () {confirmAll(marker); };
    }

    //function to allow the user to unconfirm marker location and change it
    function unConfirmMarker(map, marker, confirmLocButton, geoLocationWorks) {
        //close the popUp and show the confirm button
        document.getElementById('popUpUpload').style.display = 'none';
        document.getElementById('dimmer').style.display = 'none';
        confirmLocButton.style.display = 'block';
        document.getElementById('uploadHeading').innerHTML = 'Confirm marker position or modify';

        //turns all methods of editing the marker back on
        allowMarkerEditing(map, marker, confirmLocButton, geoLocationWorks);
    }

    //function to save all of the information as a new entry in the database
    function confirmAll(marker) {
        // create references to the firebase database and to geofire
        var firebaseRef = new Firebase("https://loocation.firebaseio.com/");
        var geoFireRef = new GeoFire(firebaseRef.child("locations"));

        //create an empty object to put the filter information into
        var looFilters = {};
        //array containing the property categories for each filter as they will be saved in the database
        var properties = ['male', 'fem', 'uni', 'mBab', 'fBab', 'uBab', 'wheelchair'];
        //array that holds HTML checkbox ids
        var values = ['maleUpload', 'femaleUpload', 'uniUpload', 'maleBabyUpload', 'femBabyUpload', 'uniBabyUpload', 'wheelchairUpload'];
        //assign the filters to the looFilters object, declaring them either true or false depending on the user's input
        for (var i = 0; i < properties.length; i++) {
            values[i] = document.getElementById(values[i]);
            looFilters[properties[i]] = values[i].checked
        }
        //upload the filter information to firebase under the filters child using a unique key generated by Firebase, then add the marker location using geoFire with the same key
        geoFireRef.set(firebaseRef.child("filters").push(looFilters).key(), [marker.position.lat(), marker.position.lng()]).then(function() {
            alert("Your new Loocation has been saved successfully. Thank you for your contribution.");
            endUpload();
        }, function(error) {
            alert('Unfortunately the Loocation has not saved correctly');
        });   
    }
}

