//insert code here!
var attrArray = ["home_price"];

var expressed = attrArray[0]

window.onload = setMap;

function setMap(){
    //map frame dimensions
    var width = window.innerWidth * 1,
    height = window.innerHeight * 1;

    //create new svg container for the map
    var map = d3.select("#mapContainer")
         .append("svg")
         .attr("class", "map")
         .attr("width", width)
         .attr("height", height);

    // Add group for zoom transformations
    var g = map.append("g");

    // Create zoom behavior
    var zoom = d3.zoom()
        .scaleExtent([0.30, 10]) // min and max zoom levels
        .on("zoom", zoomed);

    // Apply zoom behavior to the map
    map.call(zoom);

    // Zoom handler function
    function zoomed(event) {
        g.attr("transform", event.transform);
    }

    // Rest of your projection setup
    var projection = d3.geoAlbers()
        .center([0, 30.2])
        .rotate([91,2, 0]) 
        .parallels([29.5, 30.5])
        .scale(27500)
        .translate([width / 2 - 400 , height / 2 + 800]);

    var path = d3.geoPath()
        .projection(projection);

    var promises = [
        d3.csv("data/home_price_20241231.csv"),
        d3.json("data/LA_county.topojson"),
        d3.json("data/cancer_alley_parishes.topojson"),
        d3.json("data/LA_river.topojson"),
        d3.json("data/TRI_cancer_perish.topojson")        
    ];

    Promise.all(promises).then(callback);

    function callback(data){
        var homePriceData = data[0];
        var allParishes = data[1],
            cancerAlleyParishes = data[2],
            river = data[3],
            sites = data[4];
    
        // Convert to GeoJSON
        var laParishes = topojson.feature(allParishes, allParishes.objects.LA_county);
        var cancerAlley = topojson.feature(cancerAlleyParishes, 
                          cancerAlleyParishes.objects.cancer_alley_parishes);
    
        // Join data with ALL parishes (not just cancer alley)
        laParishes.features = joinData(laParishes.features, homePriceData);
        
        // Create color scale
        let colorScale = makeColorScale(homePriceData);
        
        // Draw all parishes with choropleth colors (using g instead of map)
        g.selectAll(".parish")
            .data(laParishes.features)
            .enter()
            .append("path")
            .attr("class", "parish")
            .attr("d", path)
            .style("fill", d => {
                return d.properties.home_price ? 
                       colorScale(d.properties.home_price) : 
                       "#f5f5f5";
            })
            .style("stroke", "#fff")
            .style("stroke-width", "0.5px")
            .style("opacity", 0.9);
        
        // Highlight Cancer Alley parishes (using g instead of map)
        g.selectAll(".cancer-alley")
            .data(cancerAlley.features)
            .enter()
            .append("path")
            .attr("class", "cancer-alley")
            .attr("d", path)
            .style("fill", "url(#caHatch)")
            .style("stroke", "#ff0000")
            .style("stroke-width", "2px")
            .style("opacity", 0.7);
        
        // Add other elements (using g instead of map)
        setLegend(colorScale, homePriceData);
        setRiver(river, g, path); // Note: need to update setRiver to use g

        // ===== ADD PARISH LABELS HERE =====
        g.selectAll(".parish-label")
            .data(laParishes.features)
            .enter()
            .append("text")
            .attr("class", "parish-label")
            .attr("transform", function(d) {
                var centroid = path.centroid(d);
                return "translate(" + centroid + ")";
            })
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")  // Vertical centering
            .style("font-size", "9px")  // Slightly smaller
            .style("font-weight", "normal")  // Not bold
            .style("fill", "#666")  // Medium grey color
            .style("opacity", 0.8)  // Slightly transparent
            .style("pointer-events", "none")
            .text(function(d) { 
                return d.properties.NAME || d.properties.NAME_ALT;
            });

        setTRI(sites, g, projection); // Note: need to update setTRI to use g
    }
};

function joinData(parishes, homePriceData) {
    return parishes.map(parish => {
        var parishName = parish.properties.NAME || parish.properties.NAME;
        var match = homePriceData.find(d => 
            d.RegionName.includes(parishName) || 
            parishName.includes(d.RegionName.replace(" Parish", "")) ||
            parishName.replace("St. ", "Saint ") === d.RegionName.replace(" Parish", "")
        );
        
        parish.properties.home_price = match ? 
            parseFloat(match["2024-12-31"]) : 
            null;
            
        return parish;
    });
}


function setBackground(la_county, map, path){
    var counties = map.append("path")
            .datum(la_county)
            .attr("class", "counties")
            .attr("d", path);
};

function setRiver(la_river, g, path){ // Changed parameter from map to g
    var riverFeatures = topojson.feature(la_river, la_river.objects.LA_river).features;
    
    var mississippi = g.selectAll(".mississippi") // Changed from map to g
         .data(riverFeatures)
         .enter()
         .append("path")
         .attr("class", function (d){
             return "mississippi " + d.properties.name;
         })
         .attr("d", path)
         .attr("fill", "none")
         .attr("stroke", "#1f78b4")
         .attr("stroke-width", 4);
};

function setTRI(tri_sites, g, projection){ // Changed parameter from map to g
    var triFeatures = topojson.feature(tri_sites, tri_sites.objects.TRI_cancer_perish).features;
    
    var tri = g.selectAll(".tri") // Changed from map to g
        .data(triFeatures)
        .enter()
        .append("circle")
        .attr("class", function(d){
            return "tri " + (d.properties.FACILIT || d.properties.name || "unknown");
        })
        .attr("r", 3)
        .attr("transform", function(d){
            var coords = projection(d.geometry.coordinates);
            return "translate(" + coords + ")";
        })
        .on("mouseover", function(event, d){
            console.log("TRI properties:", d.properties);
            setLabel(d.properties);
        })
        .on("mousemove", function(event){
            moveLabel(event);
        })
        .on("mouseout", function(){
            d3.select(".infolabel").remove();
        });
};


function makeColorScale(data) {
    // Your preferred colors condensed to 5 buckets
    var colorClasses = [
'#ffffd4','#fed98e','#fe9929','#d95f0e','#993404'
    ];

    var prices = data.map(d => parseFloat(d["2024-12-31"]))
                   .filter(d => !isNaN(d));

    return d3.scaleQuantize()
        .domain(d3.extent(prices))
        .range(colorClasses);
}

function drawAllParishes(parishes, map, path, colorScale) {
    // Remove any existing parish paths
    map.selectAll(".parish").remove();
    
    // Draw all parishes
    map.selectAll(".parish")
        .data(parishes.features)
        .enter()
        .append("path")
        .attr("class", "parish")
        .attr("d", path)
        .style("fill", d => {
            return d.properties.home_price ? 
                   colorScale(d.properties.home_price) : 
                   "#f5f5f5"; // Light gray for missing data
        })
        .style("stroke", "#fff")
        .style("stroke-width", "0.5px")
        .style("opacity", 0.9);
}

function highlightCancerAlley(cancerAlley, map, path) {
    // Add hatch pattern definition
    var defs = map.append("defs");
    defs.append("pattern")
        .attr("id", "caHatch")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 4)
        .attr("height", 4)
        .append("path")
        .attr("d", "M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2")
        .attr("stroke", "#ff0000")
        .attr("stroke-width", 0.5);

    // Draw Cancer Alley parishes with red hatch and border
    map.selectAll(".cancer-alley")
        .data(cancerAlley.features)
        .enter()
        .append("path")
        .attr("class", "cancer-alley")
        .attr("d", path)
        .style("fill", "url(#caHatch)")
        .style("stroke", "#ff0000")
        .style("stroke-width", "2px")
        .style("opacity", 0.7);
}

// function highlightCancerAlley(cancerAlley, map, path) {
//     // Add cross-hatch pattern definition
//     var defs = map.append("defs");
    
//     // Create cross-hatch pattern
//     defs.append("pattern")
//         .attr("id", "caCrossHatch")
//         .attr("patternUnits", "userSpaceOnUse")
//         .attr("width", 8)
//         .attr("height", 8)
//         .append("g")
//         .style("stroke", "#ff0000") // Red color for the hatch
//         .style("stroke-width", 1)   // Thinner lines
//         .html('<path d="M-1,1 l2,-2 M0,8 l8,-8 M7,9 l2,-2" />' + 
//               '<path d="M1,-1 l-2,2 M8,0 l-8,8 M9,7 l-2,2" />');

//     // Draw Cancer Alley parishes with cross-hatch border and no fill
//     g.selectAll(".cancer-alley")
//         .data(cancerAlley.features)
//         .enter()
//         .append("path")
//         .attr("class", "cancer-alley")
//         .attr("d", path)
//         .style("fill", "none")  // No fill
//         .style("stroke", "url(#caCrossHatch)")  // Use the cross-hatch pattern
//         .style("stroke-width", "4px")  // Thicker stroke for visibility
//         .style("opacity", 0.9);  // Slightly more opaque
// }


//function to recolor the map
function recolorMap(colorScale){
    d3.selectAll(".cancer_parish")
        .transition()
        .duration(500)
        .style("fill", function(d){
            const val = d.properties[expressed];
            return colorScale(val) || "#ccc";
        });
};

function createRadioButtons(attributes, homePriceData) {
    const container = d3.select("#classbutton");
    container.selectAll("*").remove(); 
    
    container.append("b").text("Home Price Data").append("br");
    
    // Since we only have one attribute now, we might just show a label
    container.append("label")
        .text("Median Home Prices (2024)")
        .style("font-weight", "bold")
        .style("margin-right", "10px");
};

function setLegend(colorScale, homePriceData, options = {}) {
    // Default options that you can override
    const defaults = {
        width: 300,
        height: 150,
        itemHeight: 25,
        fontSize: 12,
        title: "Home Prices (2024)",
        titleFontSize: 14,
        margins: { top: 20, right: 10, bottom: 10, left: 10 }
    };
    
    const config = { ...defaults, ...options };
    
    // Clear previous legend
    const legend = d3.select("#legendContainer")
        .html("")
        .append("svg")
        .attr("width", config.width)
        .attr("height", config.height);

    // Add title
    legend.append("text")
        .attr("x", config.margins.left)
        .attr("y", config.margins.top)
        .text(config.title)
        .style("font-size", config.titleFontSize + "px")
        .style("font-weight", "bold");

    // Create legend items
    const thresholds = colorScale.thresholds();
    const colors = colorScale.range();

    colors.forEach((color, i) => {
        const yPos = config.margins.top + 20 + (i * config.itemHeight);
        
        // Color swatch
        legend.append("rect")
            .attr("x", config.margins.left)
            .attr("y", yPos - 15)
            .attr("width", 20)
            .attr("height", 20)
            .attr("fill", color);

        // Text label
        const minVal = i === 0 
            ? Math.floor(colorScale.domain()[0])
            : Math.ceil(thresholds[i-1]);
            
        const maxVal = i === colors.length - 1
            ? Math.ceil(colorScale.domain()[1])
            : Math.floor(thresholds[i]);

        legend.append("text")
            .attr("x", config.margins.left + 30)
            .attr("y", yPos)
            .text(`$${minVal.toLocaleString()} - $${maxVal.toLocaleString()}`)
            .style("font-size", config.fontSize + "px");
    });
}

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