//insert code here!
var attrArray = ["home_price"];

var expressed = attrArray[0]

window.onload = setMap;

function setMap() {
    // Map frame dimensions
    var width = window.innerWidth * 1,
        height = window.innerHeight * 1;

    // Create SVG container
    var map = d3.select("#mapContainer")
        .append("svg")
        .attr("class", "map")
        .attr("width", width)
        .attr("height", height);

    // Add group for zoom transformations
    var g = map.append("g")
        .attr("class", "map-group");

    // Set up projection
    var projection = d3.geoAlbers()
        .center([0, 30.2])
        .rotate([91, 2, 0])
        .parallels([29.5, 30.5])
        .scale(27500)
        .translate([width / 2 - 400, height / 2 + 800]);

    var path = d3.geoPath()
        .projection(projection);

    // Set up zoom behavior
    var zoom = d3.zoom()
        .scaleExtent([0.30, 10])
        .on("zoom", function(event) {
            g.attr("transform", event.transform);
        });
    map.call(zoom);

    // Load data
    var promises = [
        d3.csv("data/home_price_20241231.csv"),
        d3.json("data/LA_county.topojson")
    ];

    Promise.all(promises).then(function(data) {
        var homePriceData = data[0];
        var allParishes = topojson.feature(data[1], data[1].objects.LA_county);

        // Define Cancer Alley parishes manually
        const cancerAlleyParishes = [
            'Jefferson', 'Plaquemines', 'Saint Bernard', 'Orleans',
            'Saint Charles', 'Saint John the Baptist', 'Ascension',
            'Saint James', 'Iberville', 'East Baton Rouge', 'West Baton Rouge'
        ];

        // Join data and mark Cancer Alley parishes (corrected syntax)
        allParishes.features = allParishes.features.map(parish => {
            const match = homePriceData.find(d => 
                d.RegionName.includes(parish.properties.NAME) || 
                parish.properties.NAME.includes(d.RegionName.replace(" Parish", "")) ||
                parish.properties.NAME.replace("St. ", "Saint ") === d.RegionName.replace(" Parish", "")
            );
            
            return {
                ...parish,
                properties: {
                    ...parish.properties,
                    home_price: match ? parseFloat(match["2024-12-31"]) : null,
                    isCancerAlley: cancerAlleyParishes.includes(parish.properties.NAME)
                }
            };
        });

        // Create color scale
        const colorScale = makeColorScale(homePriceData);

        // Draw all parishes
        g.selectAll(".parish")
            .data(allParishes.features)
            .enter()
            .append("path")
            .attr("class", d => `parish ${d.properties.isCancerAlley ? 'cancer-alley' : ''}`)
            .attr("d", path)
            .style("fill", d => d.properties.home_price ? colorScale(d.properties.home_price) : "#f5f5f5")
            .style("stroke", "#fff")
            .style("stroke-width", "0.5px")
            .on("mouseover", function(event, d) {
                if (d.properties.isCancerAlley) {
                    const hoveredPrice = d.properties.home_price;
                    const range = [hoveredPrice * 0.9, hoveredPrice * 1.1];
                    
                    g.selectAll(".parish")
                        .classed("highlighted", p => 
                            !p.properties.isCancerAlley && 
                            p.properties.home_price >= range[0] && 
                            p.properties.home_price <= range[1]
                        )
                        .classed("faded", p => 
                            !p.properties.isCancerAlley && 
                            (p.properties.home_price < range[0] || 
                             p.properties.home_price > range[1])
                        );
                }
            })
            .on("mouseout", function() {
                g.selectAll(".parish")
                    .classed("highlighted", false)
                    .classed("faded", false);
            });

        // Style Cancer Alley parishes
        g.selectAll(".cancer-alley")
            .style("fill", "url(#caHatch)")
            .style("stroke", "red")
            .style("stroke-width", "2px")
            .style("opacity", 0.7);

        // Add pattern definition
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

        setLegend(colorScale, homePriceData);
    });
}


function callback(data) {
    const homePriceData = data[0];
    const allParishes = topojson.feature(data[1], data[1].objects.LA_county);
    
    // Manual list of Cancer Alley parishes
    const cancerAlleyParishes = [
        'Jefferson', 'Plaquemines', 'Saint Bernard', 'Orleans',
        'Saint Charles', 'Saint John the Baptist', 'Ascension',
        'Saint James', 'Iberville', 'East Baton Rouge', 'West Baton Rouge'
    ];

    // Join data
    allParishes.features = joinData(allParishes.features, homePriceData);
    
    // Add Cancer Alley flag
    allParishes.features.forEach(parish => {
        parish.properties.isCancerAlley = cancerAlleyParishes.includes(parish.properties.NAME);
    });

    // Create color scale
    const colorScale = makeColorScale(homePriceData);

    // Draw all parishes
    g.selectAll(".parish")
        .data(allParishes.features)
        .enter()
        .append("path")
        .attr("class", d => `parish ${d.properties.isCancerAlley ? 'cancer-alley' : ''}`)
        .attr("d", path)
        .style("fill", d => colorScale(d.properties.home_price))
        .style("stroke", "#fff")
        .style("stroke-width", "0.5px")
        .on("mouseover", function(event, d) {
            if (d.properties.isCancerAlley) {
                const hoveredPrice = d.properties.home_price;
                const range = [hoveredPrice * 0.9, hoveredPrice * 1.1];
                
                g.selectAll(".parish")
                    .classed("highlighted", p => 
                        !p.properties.isCancerAlley && 
                        p.properties.home_price >= range[0] && 
                        p.properties.home_price <= range[1]
                    )
                    .classed("faded", p => 
                        !p.properties.isCancerAlley && 
                        (p.properties.home_price < range[0] || 
                         p.properties.home_price > range[1])
                    );
            }
        })
        .on("mouseout", function() {
            g.selectAll(".parish")
                .classed("highlighted", false)
                .classed("faded", false);
        });

    // Style Cancer Alley parishes
    g.selectAll(".cancer-alley")
        .style("fill", "url(#caHatch)")
        .style("stroke", "red")
        .style("stroke-width", "2px");
}

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
        // .on("mouseover", function(event, d){
        //     console.log("TRI properties:", d.properties);
        //     setLabel(d.properties);
        // })
        // .on("mousemove", function(event){
        //     moveLabel(event);
        // })
        // .on("mouseout", function(){
        //     d3.select(".infolabel").remove();
        // });
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

function highlightCancerAlley(cancerAlley, map, path, colorScale, laParishes, g) {
    // 1. Create cancer alley paths (visual only)
    g.selectAll(".cancer-alley")
        .data(cancerAlley.features)
        .enter()
        .append("path")
        .attr("class", "cancer-alley")
        .attr("d", path)
        .style("fill", "url(#caHatch)")
        .style("stroke", "red")
        .style("stroke-width", "2px")
        .style("opacity", 0.7)
        .style("pointer-events", "none"); // Disable direct interaction

    // 2. Create lookup of Cancer Alley parish names
    const cancerAlleyNames = new Set(
        cancerAlley.features.map(feature => feature.properties.NAME)
    );

    // 3. Add pointer event delegation
    const svgElement = map.node();
    svgElement.addEventListener('pointermove', (event) => {
        const point = d3.pointer(event, svgElement);
        const target = document.elementFromPoint(point[0], point[1]);
        
        // Check if we're over a cancer alley parish
        const isOverCA = cancerAlley.features.some(feature => {
            const pathElement = document.querySelector(`path[data-name="${feature.properties.NAME}"]`);
            return pathElement && pathElement.contains(target);
        });

        if (isOverCA) {
            const hoveredFeature = cancerAlley.features.find(feature => {
                const pathElement = document.querySelector(`path[data-name="${feature.properties.NAME}"]`);
                return pathElement && pathElement.contains(target);
            });

            if (hoveredFeature) {
                console.log("Delegated hover over:", hoveredFeature.properties.NAME);
                const hoveredPrice = hoveredFeature.properties.home_price;
                const range = [hoveredPrice * 0.9, hoveredPrice * 1.1];
                
                // Highlight matching parishes
                g.selectAll(".parish").classed("highlighted", p => 
                    !cancerAlleyNames.has(p.properties.NAME) && 
                    p.properties.home_price >= range[0] && 
                    p.properties.home_price <= range[1]
                );
                return;
            }
        }
        
        // Reset if not hovering over CA
        g.selectAll(".parish").classed("highlighted", false);
    });

    // 4. Add names to paths for debugging
    g.selectAll(".cancer-alley")
        .attr("data-name", d => d.properties.NAME);
}


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