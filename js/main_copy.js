//insert code here!
var attrArray = ["Total_Pop", "white", "black", "poverty_rates", "cancer_inc_rate_per_100000"]

var expressed = attrArray[0]

window.onload = setMap();

// set up map
function setMap(){

    //map frame dimensions
    var width = window.innerWidth * 1,
    height = window.innerHeight * 1 ;

 //create new svg container for the map
    var map = d3.select("body")
         .append("svg")
         .attr("class", "map")
         .attr("width", width)
         .attr("height", height);

    // ===== Jonathan CHANGE 1 =====
    // Added a group (g) inside the map SVG for zoom transformations
    var g = map.append("g");  // This group will hold all map elements and receive zoom transforms

 //create Albers equal area conic projection centered on Cancer Alley, Louisiana
    var projection = d3.geoAlbers()
        .center([0, 30.2])
        .rotate([91,2, 0]) 
        .parallels([29.5, 30.5])
        .scale(27500)
        .translate([width / 2 - 400 , height / 2 + 800]);

    var path = d3.geoPath()
        .projection(projection);

    // ===== Jonathan CHANGE 2 =====
    // Created zoom behavior
    var zoom = d3.zoom()  // Defines the zoom behavior with scale limits and handler
        .scaleExtent([0.45, 15]) // min and max zoom levels, smaller number is for zooming 'out'
        .on("zoom", zoomed);
    
    // ===== Jonathan CHANGE 3 =====
    // Applied zoom behavior to the map (SVG element)
    map.call(zoom);  // Attaches the zoom behavior to the root SVG element


    // ===== CHANGE 4 =====
    // Function to handle zoom events
    function zoomed(event) {
        g.attr("transform", event.transform); // Applies the zoom/pan transform to the group (g) while map stays fixed
    }

    var promises = [
        d3.csv("data/LA_layer_data.csv"),
        d3.json("data/LA_county.topojson"),
        d3.json("data/cancer_alley_parishes.topojson"),
        d3.json("data/LA_river.topojson"),
        d3.json("data/TRI_cancer_perish.topojson")
    ];

    Promise.all(promises).then(callback);

    // callback function
    function callback(data){
        var csvData = data[0],
            county = data[1],
            cancer_parish = data[2],
            river = data[3],
            sites = data[4];
        console.log(csvData)
        //convert topojson to geojson
        var la_county = topojson.feature(county, county.objects.LA_county),
            la_cancer_parish = topojson.feature(cancer_parish, cancer_parish.objects.cancer_alley_parishes);
            la_river = topojson.feature(river, river.objects.LA_river),
            tri_sites = topojson.feature(sites, sites.objects.TRI_cancer_perish)

        // check that it works
        console.log(la_county);
        console.log(la_cancer_parish);
        console.log(la_river)
        console.log(tri_sites)

        la_cancer_parish.features = joinData(la_cancer_parish.features, csvData);
        //console.log(la_cancer_parish.features[0].properties); // to verify
         
        // ===== Jonathan CHANGE 5 =====
        // Changed all map element creations to append to g instead of map
        // This ensures all elements get transformed together during zoom
        // Changed all map.append() and map.selectAll() to g.append() and g.selectAll()
        
        // Original: var counties = map.append("path")
        var counties = g.append("path")
            .datum(la_county)
            .attr("class", "counties")
            .attr("d", path);

        // Original: var cancer_parish = map.selectAll(".cancer_parish")
        var cancer_parish = g.selectAll(".cancer_parish")
            .data(la_cancer_parish.features)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "cancer_parish regions " + d.properties.NAME;
            })
            .attr("d", path)

        // Original: var mississippi = map.selectAll(".mississippi")
        var mississippi = g.selectAll(".mississippi")
             .data(la_river.features)
             .enter()
             .append("path")
             .attr("class", function (d){
                 return "mississippi " + d.properties.name;
             })
             .attr("d", path)
             .attr("fill", "none")
             .attr("stroke-width", 4)    

        // Original: var tri = map.selectAll(".tri")
        var tri = g.selectAll(".tri")
            .data(tri_sites.features)
            .enter()
            .append("circle")
            .attr("class", function (d){
                return "tri " + d.properties.FACILIT;
            })
            .attr("r", 3)
             .attr ("transform", function(d){
                var coords = projection(d.geometry.coordinates);
                 return "translate (" + coords + ")";
            })
    };
};

function joinData(la_cancer_parish, csvData){
    //loop through the csv to set each with the geojson region
    for (var i = 0; i < csvData.length; i++) {
        var csvRegion = csvData[i] //the current region
        var csvKey = csvRegion.Parish // primary key

        //loop through geojson to get the correct county
        for (var a = 0; a < la_cancer_parish.length; a++){
            var geojsonProps = la_cancer_parish[a].properties;
            var geojsonKey = geojsonProps.NAME_ALT;

            //the keys match
            if (geojsonKey == csvKey){

                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr]);
                    geojsonProps[attr] = val;
                    
                });
            }
        }
    }
    return la_cancer_parish;
};
