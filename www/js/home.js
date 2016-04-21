function runApp() {
    
    
    var firebaseRef = new Firebase("https://loocation.firebaseio.com/");
    var geoFireRef = new GeoFire(firebaseRef.child("locations"));

    var map;
    var meMarker;
    var radiusInKm = 2
    var geoLoc = [-36.8436, 174.7669]

    var geoQuery = geoFireRef.query({
        center: geoLoc,
        radius: radiusInKm
    });

    var looArray = [];
    var watchPos;

    var searching = false;

    var checkValues;
    var infoValues;
    var originalPos;

    var filtWindow = document.getElementById("popUpFilter");
    var doneButton = document.getElementById('doneInfo');

    //sets up variables needed for edit mode
    var editButton = document.getElementById('filterEdit');
    var editing;

    document.getElementById('uploadButton').onclick = uploadPage;
    document.getElementById('creditsButton').onclick = openCredits;
    document.getElementById("filterButton").onclick = openFilters;

    initMap();

    //functions for the basic loading and filtering of the page

    //function to load the map
    function initMap() {
        //displays the google Map
        map = new google.maps.Map(document.getElementById('map'), {
            center: {lat: -36.86803405818809, lng: 174.75977897644043},
            zoom: 15,
            //disable default controls and properties of the map
            streetViewControl: false,
            mapTypeControl: false,
            zoomControl: false,
            disableDoubleClickZoom: true
        });

        //creates a marker to represent the user's location
        meMarker = new google.maps.Marker ({
            map: map,
                icon: {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 6,
                    strokeWeight: 2,
                    strokeColor: 'black',
                    fillOpacity: 1,
                    fillColor: '#00CCCC'
                }
        });

        //if geolocation is working/enabled center the map on the user's position
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (pos) {
                var initialLocation = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
                map.setCenter(initialLocation);
            });
            //using the watchPosition method, change the location of the meMarker every time the user's location changes.
            watchPos = navigator.geolocation.watchPosition(function (pos) {
                //only update the marker's position if the user hasn't searched a location - once the user has searched a location the marker update needs to stop so that it can stay in the searched position
                if (!searching) {
                    var posNow = new google.maps.LatLng(pos.coords.latitude, pos.coords.longitude);
                    meMarker.setPosition(posNow)
                }
            });


    }



        //retrieves locations from the database with the loadData function
        loadData();

        //when the search button is clicked enter search mode
        document.getElementById('searchButton').onclick = search;





        //changes the geoquery whenever the meMarker moves, meaning that the map will display bathrooms around the meMarker. By only loading bathrooms near the user, the app is reducing its load time and data usage.
        function updateGeo () {
           var latLng = meMarker.getPosition()
           geoQuery.updateCriteria ({
               center: [latLng.lat(), latLng.lng()],
               radius: radiusInKm
           });

        }

       //run the updateGeo function when the meMarker moves. The me marker will move whenever the user's location changes, or when the user searches anywhere.
        meMarker.addListener('position_changed', updateGeo);

    }


    //enters search mode, allowing the user to search for a location to use as their position/future position
    function search() {
        //hide and display elements on the page so that the search bar and button appear in the header
        document.getElementById('searchButton').style.display = 'none';
        document.getElementById('filterButton').style.display = 'none';
        document.getElementById('uploadButton').style.display = 'none';
        
        document.getElementById('searchDiv').style.display = 'inline-block';
        document.getElementById('backArrow').style.display = 'inline-block';
        
        var input = document.getElementById('searchIndex');
        document.getElementById('backArrow').onclick = endSearch;


        //create an autocomplete variable, to give suggestions for the search. Since I have put no bounds on the autocomplete, it will bias its results to the user's location - if in Auckland, results will be biased towards places in Auckland etc.
        var autocomplete = new google.maps.places.Autocomplete(input);
        var timer = null;
        //whenever the user presses a key, the timer will be cleared
        input.onkeydown = function() {
            clearTimeout(timer);
        };

        //when the user has selected a place from the autocomplete, they officially enter 'search mode', and the meMarker becomes fixed on the point that they have selected.
        autocomplete.addListener('place_changed', function() {
            searching = true;
            navigator.geolocation.clearWatch(watchPos);
            var place = autocomplete.getPlace().geometry.location;
            map.setCenter(place);
            meMarker.setPosition(place);
            //if the input is not typed in for 6 seconds after the place has changed, the searchbar header will revert to the original header. This is to enhance the user experience, and to make sure no user's accidentally get stuck with that header.
            timer = setTimeout(endSearch, 6000)
        });

    }

    //removes the searchbar header elements and puts the original buttons back in the search bar
    function endSearch() {
        document.getElementById('searchDiv').style.display = 'none';
        document.getElementById('searchButton').style.display = 'inline-block';
        document.getElementById('backArrow').style.display = 'none';

        document.getElementById('filterButton').style.display = 'inline-block';
        document.getElementById('uploadButton').style.display = 'inline-block';

    }


    //function to retrieve the locations in the database
    function loadData() {
        //remove all markers if there are any
        for (var i = 0; i < looArray.length; i++) {
            looArray[i].marker.setMap(null);
        }
        looArray = [];

        //get the user's preferences saved in the localStorage and store them in variables.
        var allPrefs = getPrefs();
        var genderPrefs = allPrefs.genderPrefs;
        var babyPrefs = allPrefs.babyPrefs;
        var accessPrefs = allPrefs.accessPrefs;

        //set cog icon depending on whether any filters are active
        if (genderPrefs.length != 0 || babyPrefs.length != 0 || accessPrefs != null) {
            document.getElementById("cog").src = "img/cogTick.svg";
        } else {
            document.getElementById("cog").src = "img/cogInitial.svg";
        }

        //ticks filter checkboxes if they are in the preferences
        //see other method of doing this in notes
        for (var i = 0; i < genderPrefs.length; i++) {
            document.getElementById(genderPrefs[i]).checked = true;
        }
        for (var i = 0; i < babyPrefs.length; i++) {
            document.getElementById(babyPrefs[i]).checked = true;
        }
        if (accessPrefs) {
            document.getElementById("wheelchair").checked = true;
        }


        //create a marker for every location in the database within the geoQuery
        geoQuery.on("key_entered", function (key, location, distance) {
            var markerPos = {lat: location[0], lng: location[1]};
            var marker = new google.maps.Marker({
                position: markerPos,
                //make sure the marker doesn't display on the map until required
                map: null
            });
            var markerObject = {
                key: key,
                marker: marker,
            }

            //add the marker and its key to an array
            looArray.push(markerObject);

            //run the filterLoo function, to determine whether each marker meets the user's filter preferences, and if so displays that marker
            filterLoo(key, marker, genderPrefs, babyPrefs, accessPrefs);

        });
    }

    //function which returns saved preferences from the local storage
    function getPrefs() {
        //set default values of none for all preferences
        var genderPrefs = [];
        var babyPrefs = [];
        var accessPrefs = null;

        //set the preferences to the values stored in the local storage provided there is data there
        if(typeof(Storage) !== "undefined" && localStorage.getItem('genderPrefs') != null) {
            genderPrefs = JSON.parse(localStorage.getItem('genderPrefs'));
            babyPrefs = JSON.parse(localStorage.getItem('babyPrefs'));
            accessPrefs = JSON.parse(localStorage.getItem('accessPrefs'));
        }    
        return {
            genderPrefs: genderPrefs,
            babyPrefs: babyPrefs,
            accessPrefs: accessPrefs
        };

    }


    //function to assess whether a loo meets filter preferences
    function filterLoo(key, marker, genderPrefs, babyPrefs, accessPrefs) {
        //variables for whether the particular loo being evaluated meets the filters
        var genderHappy = null;
        var babyHappy = null;
        var accessHappy = null;

        var filters = firebaseRef.child("filters/" + key);
        //retrieve the loo's filter information from the database and evaluate it
        filters.on("value", function(snapshot) {
            var values = snapshot.val();
            //assess whether it meets the gender preferences
            if (genderPrefs.length != 0) {
                for (var i = 0; i < genderPrefs.length; i++) {
                    if (values[genderPrefs[i]]) {
                        genderHappy = true;
                    }
                }
            } else {
                genderHappy = true;
            }

            //assess whether it meets the baby preferences
            if (babyPrefs.length != 0) {
                for (var i = 0; i < babyPrefs.length; i++) {
                    if (values[babyPrefs[i]]) {
                        babyHappy = true;
                    }
                }
            } else {
                babyHappy = true;
            }

            //assess whether it meets the access preferences
            if (accessPrefs) {
                if (values['wheelchair']) {
                    accessHappy = true;
                }
            } else {
                accessHappy = true;
            }

            //if the loo meets all preferences put it on the map
            if (genderHappy && babyHappy && accessHappy) {
                if (marker.map == null) {
                    marker.setMap(map);
                }

                //when the marker is clicked, run the openInfo function
                markerListener = marker.addListener("click", function() {
                    //determine the index in the array of the current markerobject
                    var looIndex;
                    for (var i = 0; i < looArray.length; i++) {
                        if(looArray[i].key == key) {
                            looIndex = i;
                        }
                    }
                    //finds the address of the chosen loo
                    getAddress(marker.position);
                    //run the openInfo function with the list of values and the item in the looArray
                    openInfo(values, looArray[looIndex]);})
            } else {
                //remove the loo from the map
                marker.setMap(null);
            }

        });
    }


    //runs a loop that executes the filterLoo function for every loo in the looArray
    function filterAll(genderPrefs, babyPrefs, accessPrefs) {
        for (var i = 0; i < looArray.length; i++) {
            filterLoo(looArray[i].key, looArray[i].marker, genderPrefs, babyPrefs, accessPrefs);
        }
    }



    //opens the filter dialog box and stops the moving of the map
    function openFilters() {
        document.getElementById('dimmer').style.display = 'block';
        filtWindow.style.display = 'block';
        map.setOptions({draggable: false});
        document.getElementById('filterCancel').onclick = closeFilters;
    }

    //update or set the user's filter preferences and close the filter window
    function closeFilters() {
        document.getElementById('dimmer').style.display = 'none';
        //clear the preferences
        var genderPrefs = [];
        var babyPrefs = [];
        var accessPrefs = null;


        //ids of each checkbox and the ids of the filters in firebase
        var filterIds = ['male', 'fem', 'uni', 'mBab', 'fBab', 'uBab'];

        //add every gender preference to the genderPrefs array
        for (var i=0; i<3; i++) {
            if(document.getElementById(filterIds[i]).checked) {
                genderPrefs.push(filterIds[i]);
            }
        }
        //add every baby preference to the babyPrefs array
        for (var i=3; i<6; i++) {
            if(document.getElementById(filterIds[i]).checked) {
                babyPrefs.push(filterIds[i]);
            }
        }

        //determine whether wheelchair access has been requested
        if (document.getElementById("wheelchair").checked) {
            accessPrefs = true;
        }


        //filter the loos according to preferences
        filterAll(genderPrefs, babyPrefs, accessPrefs);

        //set cog icon depending on whether any filters are active
        if (genderPrefs.length != 0 || babyPrefs.length != 0 || accessPrefs != null) {
            document.getElementById("cog").src = "img/cogTick.svg";
        } else {
            document.getElementById("cog").src = "img/cogInitial.svg";
        }

        //save the preferences in local storage provided the user has access to local storage. Setting the preferences in local storage means they will be saved for future use.
        if(typeof(Storage) !== "undefined") {
            localStorage.setItem('genderPrefs', JSON.stringify(genderPrefs));
            localStorage.setItem('babyPrefs', JSON.stringify(babyPrefs));
            localStorage.setItem('accessPrefs', JSON.stringify(accessPrefs));
        } else {
            alert("Unfortunately your preferences are unable to be saved for future use on this phone. You will need to reenter them each time you open the app.");
        }

        //close the filters window
        filtWindow.style.display = 'none';
        map.setOptions({draggable: true});



    }


    //opens the upload page
    function uploadPage() {
        window.open("upload.html", "_self");
    }

    //function that will eventually dictate what happens when the credits button is clicked
    function openCredits() {
        document.getElementById("credits").style.display = "block";

        document.getElementById("closeCred").onclick = function() {document.getElementById("credits").style.display = "none";};
    }


    //opens an infoWindow displaying relevant information about the selected loo
    function openInfo(values, looObject){
        //saves the marker's initial position in a variable so that it can be used later to determine whether the marker has been moved
        var firstLatLng = looObject.marker.position;
        //sets up variables needed for edit mode
        editing = false;

        //ids for each checkbox in the HTML
        checkValues = ['maleInfo', 'femaleInfo', 'uniInfo', 'maleBabyInfo', 'femBabyInfo', 'uniBabyInfo', 'wheelchairInfo'];
        //corresponding values of each filter as they are entered into the firebase database
        infoValues = [values.male, values.fem, values.uni, values.mBab, values.fBab, values.uBab, values.wheelchair];



        //ticks checkboxes depending whether the properties are true or false in the database
        for (var i = 0; i < checkValues.length; i++) {
            document.getElementById(checkValues[i]).checked = infoValues[i];
            document.getElementById(checkValues[i]).disabled = true;
        }

        //opens the infoWindow
        document.getElementById('popUpInfo').style.display = 'block';
        document.getElementById('dimmer').style.display = 'block';
        map.setOptions({draggable: false});

        //specifies the functions to run when different elements are clicked on, and the variables they will be passed
        document.getElementById('infoCancel').onclick = function() {closeInfo(looObject, firstLatLng)};
        editButton.onclick =  function() {determineEditFunction(looObject, firstLatLng)};
        doneButton.onclick = function() {
            if(meMarker.position == undefined || meMarker.position == null) {
                alert('Your geolocation is not working and there is no place selected as your starting point. Please use the search function to select your starting position before asking for directions')
            } else {
            giveDirections(looObject);
            }
        }
    }


    //changes the heading of the info box to the loo's formatted address
    function getAddress(markerPos) {
        //find the address using google's Geocoder service
        var geocoder = new google.maps.Geocoder();
        geocoder.geocode({'location': markerPos}, function (results, status) {
            //gives full address:
            if (status === google.maps.GeocoderStatus.OK) {
                //changes the pop-up window's content so that it displays the address
                console.log('hi');
                document.getElementById("address").innerHTML = results[0].formatted_address;
            }
        });
    }

    //gives directions to the selected loo
    function giveDirections(looObject) {
        document.getElementById('popUpInfo').style.display = 'none';
        document.getElementById('dimmer').style.display = 'none';
        map.setOptions({draggable: true});
        document.getElementById('cancIndex').innerHTML = 'Finished!';
        document.getElementById("cancIndex").onclick = function() {endDirections(directionsDisplay)};
        document.getElementById("cancIndex").style.display = 'block';
        markerListener = null;

        var directsRequest = {
            origin: meMarker.position,
            destination: looObject.marker.getPosition(),
            provideRouteAlternatives: true,
            travelMode: google.maps.TravelMode.WALKING,
            avoidHighways: true
        }

        //variable that references google's directions services
        var directionsService = new google.maps.DirectionsService();

        var directionsOptions = {
            map: map, 
            suppressMarkers: true,
            suppressInfoWindows: true,
            polylineOptions : {
                map: map, 
                strokeColor: "#00CCCC",
                strokeWeight: 6,
                strokeOpacity: 0.8
            }
        }

        //variable to keep the renderer of directions in
        var directionsDisplay = new google.maps.DirectionsRenderer(directionsOptions);


        directionsService.route(directsRequest, function(result, status) {
            if (status == google.maps.DirectionsStatus.OK) {
                directionsDisplay.setDirections(result);
                console.log(result.getPath())
            }
        });
    }

    //ends directions giving mode, hiding directions buttons and the directions polyline and returning the popUp
    function endDirections(directionsDisplay) {
        document.getElementById('popUpInfo').style.display = 'block';
        document.getElementById('dimmer').style.display = 'block';
        map.setOptions({draggable: false});
        document.getElementById('cancIndex').style.display = 'none';
        directionsDisplay.setMap(null);
        directionsDisplay = null;
        document.getElementById('cancIndex').innerHTML = 'Cancel';


    }

    //closes the infoWindow
    function closeInfo(looObject, firstLatLng) {
        document.getElementById('popUpInfo').style.display = 'none';
        map.setOptions({draggable: true});
        document.getElementById('dimmer').style.display = 'none';

        //if the user is currently in edit mode, cancel their edit
        if (editing) {
            cancelEdit(looObject, firstLatLng);
        }
    }




    //runs functions for editing depending on whether user is already in edit mode
    function determineEditFunction(looObject, firstLatLng){
        //if the user is not already editing, enter edit mode
        if (editing != true) {
                enterEditMode(looObject, firstLatLng);
        } else {
            //otherwise set everything back to its initial value and exit edit mode
            cancelEdit(looObject, firstLatLng);
        }
    };


    //puts the app into edit mode
    function enterEditMode(looObject, firstLatLng) {
        editing = true

        doneButton.innerHTML = "Done";
        editButton.src = 'img/cancelEditPencil.svg';
        document.getElementById('address').innerHTML = "Tap here to change marker location"
        document.getElementById('address').style.color = 'black';

        //make checkboxes editable
        for (var i = 0; i<checkValues.length; i++) {
            document.getElementById(checkValues[i]).disabled = false;
        }
        //specifies the functions to run when different elements are clicked on, and the variables they will be passed
        document.getElementById('address').onclick = function() {enterLocEdit(looObject)};
        doneButton.onclick = function() {saveEdit(looObject, firstLatLng)};
    
    }


    //takes the app out of edit mode
    function exitEditMode(looObject) {
        editing = false
        console.log('exiteditmode');

        doneButton.innerHTML = "Loocate!";
        editButton.src = "img/editPencil.svg";

        //disable checkboxes again
        for (var i = 0; i<checkValues.length; i++) {
            document.getElementById(checkValues[i]).disabled = true;
        }

        getAddress(looObject.marker.position);

        document.getElementById('address').style.color = 'white';

        document.getElementById('address').onclick = null;
        doneButton.onclick = function() {
            if(meMarker.position == undefined || meMarker.position == null) {
                alert('Your geolocation is not working and there is no place selected for starting point. Please use the search function to select your starting position before asking for directions')
            } else {
                giveDirections(looObject);
            }
        }
        }


    //cancels the edit and resets all information 
    function cancelEdit(looObject, firstLatLng) {
        //sets the checkboxes back to their initial values
        for (var i = 0; i<checkValues.length; i++) {
            document.getElementById(checkValues[i]).checked = infoValues[i];
        }
        //if the looObject marker has moved, put it back in its original position
        if (looObject.marker.position != firstLatLng) {
            looObject.marker.setPosition(firstLatLng);
        }  

        exitEditMode(looObject);
    }

    //saves the edited information
    function saveEdit(looObject, firstLatLng) {
       //asess the filtering information and save them in the looFilters object
        var looFilters = {};
        var properties = ['male', 'fem', 'uni', 'mBab', 'fBab', 'uBab', 'wheelchair'];

        //saves the looFilters as true or false depending on the value of the checkboxes
        for (var i = 0; i < properties.length; i++) {
            looFilters[properties[i]] = document.getElementById(checkValues[i]).checked;
        }


        //create an object and add the data to be updated, with the paths that the data will be updated to
        var updatedData = {}
        updatedData["filters/" + looObject.key] = looFilters;
        //only add the marker location information to the updatedData object if the marker has been moved
        if (firstLatLng != looObject.marker.position) {
            updatedData["locations/" + looObject.key + "/l"] = {
                0: looObject.marker.position.lat(),
                1: looObject.marker.position.lng()
            };
        }
        //update the information in the database and give it a completion callback
        firebaseRef.update(updatedData, function (error) {
            if (error) {
                console.log("Error updating data:", error);
            }
            else {
                alert("This Loocation has been successfully updated. Thank you for helping to maintain the integrity of our data.")
                exitEditMode(looObject);
            }
        });
    }

    //allows the user to edit the location of the selected marker
    function enterLocEdit(looObject) {
        //remove all markers except for the edited one from the map
        for (var i = 0; i < looArray.length; i++) {
            if (looArray[i] != looObject) {
                looArray[i].marker.setMap(null);
            }
        }

        //make the marker and map draggable
        looObject.marker.setDraggable(true);
        map.setOptions({draggable: true});

        var originalPos = looObject.marker.position;

        //hide and display certain elements
        document.getElementById('popUpInfo').style.display = 'none';
        document.getElementById('dimmer').style.display = 'none';
        document.getElementById("cancIndex").style.display = 'block';
        document.getElementById("confIndex").style.display = 'block';

        //specifies the functions to run when different elements are clicked on, and the variables they will be passed
        document.getElementById('cancIndex').onclick = function() {cancelLocationEdit(originalPos, looObject.marker)};
        //returns the user to the main editing window, without resetting the marker's position
        document.getElementById('confIndex').onclick = function() {exitLocEdit(looObject.marker)};

    }

    //ends location edit mode
    function exitLocEdit(edMarker) {
        //sets the marker back to non-draggable
        edMarker.setDraggable(false);
        map.setOptions({draggable: false});

        //gets the user preferences
        var allPrefs = getPrefs();

        //displays all bathrooms that meet the user preferences
        filterAll(allPrefs.genderPrefs, allPrefs.babyPrefs, allPrefs.accessPrefs);

        //hides and displays the necessary elements
        document.getElementById('popUpInfo').style.display = 'block';
        document.getElementById('dimmer').style.display = 'block';
        document.getElementById("cancIndex").style.display = 'none';
        document.getElementById("confIndex").style.display = 'none';


    }

    //returns the user to the main editing window after resetting the marker's position
    function cancelLocationEdit(originalPos, edMarker) {
        edMarker.setPosition(originalPos);
        exitLocEdit(edMarker);
    }

}

