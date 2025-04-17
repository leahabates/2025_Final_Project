//insert code here!
window.onload = setMap();

// set up map
function setMap(){

     //map frame dimensions
     var width = 960,
     height = 700;

 //create new svg container for the map
    var map = d3.select("body")
         .append("svg")
         .attr("class", "map")
         .attr("width", width)
         .attr("height", height);

 //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([3.64, 30.87])
        .rotate([95.55, 0, 0]) 
        .parallels([26.55, 90.00])
        .scale(10000.00)
        .translate([width / 2, height / 2]);

    var path = d3.geoPath()
        .projection(projection);

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
        
        //translate to topojson
        var la_county = topojson.feature(county, county.objects.LA_county),
            la_cancer_parish = topojson.feature(cancer_parish, cancer_parish.objects.cancer_alley_parishes);
            la_river = topojson.feature(river, river.objects.LA_river),
            tri_sites = topojson.feature(sites, sites.objects.TRI_cancer_perish)

        // check that it works
        console.log(la_county);
        console.log(la_cancer_parish);
        console.log(la_river)
        console.log(tri_sites)

        // add  LA counties
        var counties = map.append("path")
            .datum(la_county)
            .attr("class", "counties")
            .attr("d", path);

        // add cancer alley counties
        var cancer_parish = map.selectAll(".cancer_parish")
            .data(la_cancer_parish.features)
            .enter()
            .append("path")
            .attr("class", function(d){
                return "regions " + d.properties.NAME;
            })
            .attr("d", path)

        // var mississippi = map.selectAll(".mississippi")
        //     .data(la_river.features)
        //     .enter()
        //     .append("path")
        //     .attr("class", function (d){
        //         return "mississippi " + d.properties.name;
        //     })
        //     .attr("d", path)

        // var tri = map.selectAll(".tri")
        //     .data(tri_sites.features)
        //     .enter()
        //     .append("circles")
        //     .attr("class", function (d){
        //         return "tri " + d.properties.FACILIT;
        //     })
        //     .attr("r", 3)
        //     .attr ("transform", function(d){
        //         var coords = projection(d.geometry.coordinates);
        //         return "translate (" + coords + ")";
        //     })

        // console.log(tri)
    };
};
