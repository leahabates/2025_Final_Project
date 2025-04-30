
//insert code here!
var attrArray = [
    "Total Population",
    "White Population",
    "Black Population",
    "Poverty Rates",
    "Cancer Incident Rate/ 100000" // Corrected
  ];
  

var expressed = attrArray[0]

window.onload = setMap;

// set up map
function setMap(){

     //map frame dimensions
     var width = window.innerWidth * 1,
     height = window.innerHeight * 1 ;

 //create new svg container for the map
    var map = d3.select("#mapContainer")
         .append("svg")
         .attr("class", "map")
         .attr("width", width)
         .attr("height", height);

 //create Albers equal area conic projection centered on France
    var projection = d3.geoAlbers()
        .center([0, 30.2])
        .rotate([91,2, 0]) 
        .parallels([29.5, 30.5])
        .scale(27500)
        .translate([width / 2 - 400 , height / 2 + 800]);

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
        var csvData = data[0];
        var county = data[1],
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
         
        // add  LA  background counties
        setBackground(la_county, map, path)

        // add cancer alley counites
        let colorScale = makeColorScale(csvData);
        setEnumnerationUnits(la_cancer_parish, map, path, colorScale);

        // add a legend
        setLegend(colorScale, csvData);
        
       // add mississippi
       setRiver(la_river, map, path);
       
       // add TRI sites
       setTRI(tri_sites, map, projection);

       //add buttons
       createRadioButtons(attrArray, csvData);
  
    };
};
//function to join the csv data with the la_cancer_parishes
function joinData(la_cancer_parish, csvData){
    //loop through the csv to set each with the geojson region
    for (var i = 0; i < csvData.length; i++) {
        var csvRegion = csvData[i] //the current region
        var csvKey = csvRegion.Parish // primary key

        //loop through geojson to get the correct county
        for (var a = 0; a < la_cancer_parish.length; a++){
            var geojsonProps = la_cancer_parish[a].properties;
            var geojsonKey = geojsonProps.NAME_EN;

            //the keys match
            if (geojsonKey == csvKey){

                attrArray.forEach(function(attr){
                    var val = parseFloat(csvRegion[attr].replace(/,/g, ""));
                    geojsonProps[attr] = val;
                });
            }
        }
    }
    return la_cancer_parish;
};
//this function set the surrounding parishes
function setBackground(la_county, map, path){
    var counties = map.append("path")
            .datum(la_county)
            .attr("class", "counties")
            .attr("d", path);
};
//set the mississippi on the map
function setRiver(la_river, map, path){
    var mississippi = map.selectAll(".mississippi")
             .data(la_river.features)
             .enter()
             .append("path")
             .attr("class", function (d){
                 return "mississippi " + d.properties.name;
             })
             .attr("d", path)
             .attr("fill", "none")
             .attr("stroke-width", 4)
};
// sets the TRI sites and calls for the function that allow for hoovering over the sites to display information
function setTRI(tri_sites, map, projection){
    var tri = map.selectAll(".tri")
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
            .on("mouseover", function(event, d){
                console.log("TRI properties:", d.properties);
                setLabel(d.properties); // show popup
            })
            .on("mousemove", function(event){
                moveLabel(event); // follow mouse
            })
            .on("mouseout", function(){
                d3.select(".infolabel").remove(); // remove popup
            });
};

function makeColorScale (data){
    var colorClasses = ['#ffffd4','#fed98e','#fe9929','#d95f0e','#993404'];

    //craete color scale generator
    var colorScale = d3.scaleQuantile()
        .range(colorClasses);
    
    //build array of all values for the expressed attribute
    var domainArray =[]
    for (var i=0; i<data.length; ++i){
        var val = parseFloat(data[i][expressed]);
        if (!isNaN(val)) domainArray.push(val);
    };

    //assign array of expressed values as scale domain
    colorScale.domain(domainArray);

    return colorScale;
};
//function to set coloring for the enumeration units
function setEnumnerationUnits(la_cancer_parish, map, path, colorScale){
    var cancer_parish = map.selectAll(".cancer_parish")
        .data(la_cancer_parish.features)
        .enter()
        .append("path")
        .attr("class", function(d){
            return "cancer_parish regions " + d.properties.NAME_EN;
        })
        .attr("d", path)
        .style("fill", function(d){
            return colorScale(d.properties[expressed]);
        })
};
//function to recolor the map
function recolorMap(colorScale){
    d3.selectAll(".cancer_parish")
        .transition()
        .duration(500)
        .style("fill", function(d){
            const val = d.properties[expressed];
            return colorScale(val) || "#ccc"; // Fallback if data is missing
        });
    };
// function that creates buttons that user can change between attributes
function createRadioButtons(attributes, csvData) {
    const container = d3.select("#classbutton");
    container.selectAll("*").remove(); 
    
    container.append("b").text("Layer Data").append("br");
    
    attributes.forEach((attr, i) => {
        container.append("input")
            .attr("type", "radio")
            .attr("name", "attribute")
            .attr("value", attr)
            .property("checked", i === 0)
            .on("change", function () {
                expressed = this.value;
                console.log("Expressed changed to:", expressed);
                const colorScale = makeColorScale(csvData);
                recolorMap(colorScale);
                
                d3.select("#legendContainer").selectAll("svg").remove();
                setLegend(colorScale, csvData);
            });
    
        container.append("label")
            .text(" " + attr.replace(/_/g, " "))
            .style("margin-right", "10px")
            .style("margin-left", "5px")
            .style("color", "#000")  // optional if you're using a dark background
            .style("font-size", "14px");
    
        container.append("br");
    });
};
// function to create a legend that will change as user changes demographic attribute
function setLegend(colorScale, csvData){
    var legendWidth = window.innerWidth * 0.25,
        legendHeight = window.innerHeight * 0.15;

    var mapHeight = d3.select(".map").node().getBoundingClientRect().height;

    var legend = d3.select("#legendContainer")
        .append("svg")
        .attr("class", "legend")
        .attr("width", legendWidth)
        .attr("height", legendHeight+ 40); // Increased for titles and TRI dot

    var colorClasses = colorScale.range();
    var classLabels = [];

    for (var i = 0; i < colorClasses.length; i++) {
        var minVal = colorScale.invertExtent(colorClasses[i])[0];
        var maxVal = colorScale.invertExtent(colorClasses[i])[1];
        classLabels.push(`${Math.round(minVal)} - ${Math.round(maxVal)}`);
    }

    // Add main legend title 
    legend.append("text")
        .attr("class", "legendMainTitle")
        .attr("x", 5)
        .attr("y", 20)
        .style("font-size", "18px")
        .style("font-weight", "bold")
        .style("fill", "#000")
        .text("Legend");

    //Add subtitle showing the selected attribute 
    legend.append("text")
        .attr("class", "legendSubtitle")
        .attr("x", 5)
        .attr("y", 40)
        .style("font-size", "14px")
        .style("fill", "#000")
        .text(expressed.replace(/_/g, " "));

    // Shift color boxes down to leave room for titles 
    var legendItem = legend.selectAll(".legendItem")
        .data(colorClasses)
        .enter()
        .append("g")
        .attr("class", "legendItem")
        .attr("transform", function (d, i){
            return "translate(0," + (i * 20 + 50) + ")"; // Shifted down
        });

    legendItem.append("rect")
        .attr("width", legendWidth / colorClasses.length)
        .attr("height", 15)
        .attr("y", 0)
        .style("fill", function (d){ return d; });

    legendItem.append("text")
        .attr("x", (legendWidth / colorClasses.length)+10)
        .attr("y", 12)
        .attr("text-anchor","start")
        .style("fill", "#000")
        .text(function(d, i){ return classLabels[i]; });

    // TRI dot legend 
    legend.append("circle")
        .attr("cx", 10)
        .attr("cy", legendHeight + 20)
        .attr("r", 4)
        .style("fill", "red");

    legend.append("text")
        .attr("x", 25)
        .attr("y", legendHeight + 24)
        .style("fill", "#000")
        .style("font-size", "14px")
        .text("TRI Facility Site");
};
// function that when users hoover over a TRI a popup about that site
function setLabel(props){   
        // Create label content based on TRI properties
    var labelContent = `
        <h2>${props["4. FACILIT"]}</h2>
        <b>Street:</b> ${props["5. STREET"]}<br>
        <b>City:</b> ${props["6. CITY"]}<br>
        <b>County:</b> ${props["7. COUNTY"]}<br>
        <b>Chemical:</b> ${props["37. CHEMIC"] || "N/A"}<br>
        <b>Carcinogenic:</b> ${props["46. CARCIN"]}<br>
        <b>Industry:</b> ${props["23. INDUST"]}<br>
        <b>FRS ID:</b> ${props["3. FRS ID"]}
    `;
    
        //create info label div
        var infolabel = d3.select("body")
            .append("div")
            .attr("class", "infolabel")
            .html(labelContent);
    
        var regionName = infolabel.append("div")
            .attr("class", "labelname")
            .html(props.FACILIT);
         };
// function that will move the popup to the cursor
function moveLabel(event){
    // get the label div
    var label = d3.select(".infolabel");
        
            // calculate position (offset slightly so it doesn't block the cursor)
    var x = event.pageX + 10;
    var y = event.pageY - 75;
        
            // move the label
    label.style("left", x + "px")
             .style("top", y + "px");
};