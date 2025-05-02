
// Global Variables //
var attrArray = ["home_price"]; // Array of attribute names used for mapping (e.g., data fields like home prices)
var expressed = attrArray[0]; // Initial attribute to visualize is the first one in the array (i.e., "home_price")
window.onload = setMap; // When the page loads, run the setMap function to initialize the map

// Hardcoded list of parishes considered part of "Cancer Alley"
const cancerAlleyParishes = [ // These are known for high industrial pollution and cancer risks
    'Jefferson', 'Plaquemines', 'Saint Bernard', 'Orleans',  // Southeast cluster
    'Saint Charles', 'Saint John the Baptist', 'Ascension',  // River parishes
    'Saint James', 'Iberville', 'East Baton Rouge', 'West Baton Rouge'  // Capital area
];

function setMap() {
    // Map frame dimensions
    var container = document.getElementById("mapContainer") // Get the container element that will hold the map
    var width = container.clientWidth, // Get the width and height of the container
        height = container.clientHeight;

    // Create SVG container
    var map = d3.select("#mapContainer") // Select the container and append an SVG element to it
        .append("svg")  // Create SVG element
        .attr("class", "map")  // Add CSS class for styling
        .attr("width", width)  // Set width to match container
        .attr("height", height);  // Set height to match container

    // Add group for zoom transformations
    var g = map.append("g") // Append a group element that will contain all map elements
        .attr("class", "map-group");  // Add class for styling/selection

    // Set up projection
    var projection = d3.geoAlbers() // Configure Albers projection (specialized for US mapping)
        .center([0, 30.2])  // Center on latitude 30.2°N (Louisiana)
        .rotate([91, 2, 0])  // Rotate to center on Louisiana
        .parallels([29.5, 30.5])  // Standard parallels for conic projection
        .scale(27500)  // Zoom level (bigger number = more zoomed in)
        .translate([width / 2 - 400, height / 2 + 800]);  // Position on SVG

    // Create path generator that uses our projection
    var path = d3.geoPath()
        .projection(projection);  // Convert geo coordinates to SVG paths

    // Set up zoom behavior
    var zoom = d3.zoom() // Create zoom behavior with min/max zoom levels
        .scaleExtent([0.4, 10]) // Minimum 40% zoom, maximum 1000% zoom
        .on("zoom", function(event) {
            // When zooming, apply the transform to our group element
            g.attr("transform", event.transform);
        });
    // Apply the zoom behavior to our SVG map
    map.call(zoom);

    // Load multiple datasets in parallel using Promise.all
    var promises = [                             // Array of data loading promises:
        d3.csv("data/home_price_20241231.csv"),  // 1. Home price data (CSV)
        d3.json("data/LA_county.topojson"),      // 2. Parish boundaries (TopoJSON)
        d3.json("data/LA_river.topojson"),       // 3. Mississippi River (TopoJSON)
        d3.json("data/TRI_cancer_perish.topojson"), // 4. Toxic sites (TopoJSON)
        d3.json("data/states.topojson")          // 5. Background states (TopoJSON)
    ];

    // Process all loaded data when ready
    // Promise.all(promises).then(callback);  // Wait for all promises to resolve
    Promise.all(promises).then(function(data) {  // Wait for all promises to resolve
        var homePriceData = data[0];             // Extract home price data (index 0)
        var allParishes = topojson.feature(data[1], data[1].objects.LA_county); // Convert TopoJSON to GeoJSON for parishes
        var laRiver = data[2];                   // Mississippi River data
        var triSites = data[3];                  // Toxic Release Inventory sites
        var background_states = data[4];         // Surrounding states for context

        setStates(background_states, g, path);   // Draw background state boundaries
        
        // Enhance parish data with home prices and Cancer Alley status
        allParishes.features = allParishes.features.map(parish => {  // Process each parish
            // Find matching home price record (handling naming variations)
            const match = homePriceData.find(d => 
                d.RegionName.includes(parish.properties.NAME) ||                 // Case 1: Direct match
                parish.properties.NAME.includes(d.RegionName.replace(" Parish", "")) ||  // Case 2: Handle "Parish" suffix
                parish.properties.NAME.replace("St. ", "Saint ") === d.RegionName.replace(" Parish", "")  // Case 3: Handle "St." vs "Saint"
            );
            
            return {                              // Return enhanced feature:
                ...parish,                        // Spread existing properties
                properties: {                     // Add new properties:
                    ...parish.properties,         // Keep existing
                    home_price: match ? parseFloat(match["2024-12-31"]) : null,  // Add price or null if no match
                    isCancerAlley: cancerAlleyParishes.includes(parish.properties.NAME)  // Boolean flag
                }
            };
        });

        // Generate color scale function for home price visualization
        const colorScale = makeColorScale(homePriceData);  // Creates gradient based on price range

        // Create and style parish paths with interactive behaviors
        g.selectAll(".parish")                       // Select all parish elements (initially empty)
            .data(allParishes.features)                  // Bind parish GeoJSON data
            .enter()                                     // Get enter selection for new data
            .append("path")                              // Create SVG path for each parish
            .attr("class", d => `parish ${d.properties.isCancerAlley ? 'cancer-alley' : ''}`)  // Set class based on Cancer Alley status
            .attr("d", path)                             // Generate path data using projection
            .style("fill", d => d.properties.home_price ? colorScale(d.properties.home_price) : "#f5f5f5")  // Color by price or default gray
            .style("stroke", d => d.properties.isCancerAlley ? "#ff0000" : "#fff")  // Red border for Cancer Alley
            .style("stroke-width", d => d.properties.isCancerAlley ? "2px" : "0.5px")  // Thicker border for Cancer Alley

        // Mouseover interaction - highlight related parishes
        .on("mouseover", function(event, d) {
            if (d.properties.isCancerAlley) {         // Only trigger for Cancer Alley parishes
                const hoveredPrice = d.properties.home_price;  // Get current parish's price
                const range = [hoveredPrice * 0.9, hoveredPrice * 1.1];  // Create ±10% price range
                
                // Highlight current parish and its label
                d3.select(this).classed("faded", false);  // Keep current parish visible
                g.selectAll(`.parish-label[data-name="${d.properties.NAME}"]`)
                    .classed("faded", false);        // Keep current label visible
                
                // Highlight non-Cancer Alley parishes with similar prices
                g.selectAll(".parish:not(.cancer-alley), .parish-label:not(.cancer-alley-label)")
                    .classed("highlighted", p =>     // Add highlight class if:
                        p.properties?.home_price >= range[0] &&  // Price within range +/-10%
                        p.properties?.home_price <= range[1] // Price within range +/-10%
                    )
                    .classed("faded", false);        // Ensure they're not faded
                
                // Fade all other elements except: Current parish, similarly priced non-Cancer Alley parishes
                g.selectAll(".parish, .parish-label, .mississippi")
                    .classed("faded", p => 
                        (p.properties && p !== d &&   // Not current parish
                        !(p.properties.home_price >= range[0] &&  // Price not within range +/-10%
                        p.properties.home_price <= range[1] && // Price not within range +/-10%
                        !p.properties.isCancerAlley))  // And not Cancer Alley
                    );
            }
        })

        // Mouseout interaction - reset all highlights
        .on("mouseout", function() {
            g.selectAll(".parish, .parish-label, .mississippi")  // Select all map elements
                .classed("highlighted", false)       // Remove highlights
                .classed("faded", false);           // Remove fades
        });

        // Add legend to explain color scale
        setLegend(colorScale, homePriceData);            // Create and position color legend
        
        // Add parish name labels after drawing parish shapes
        g.selectAll(".parish-label")                     // Select all parish labels (empty initial selection)
            .data(allParishes.features)                  // Bind parish data to labels
            .enter()                                     // Get enter selection for new labels
            .append("text")                              // Create text element for each parish
            .attr("class", d => `parish-label ${         // Set class with conditional Cancer Alley class
                d.properties.isCancerAlley ? 'cancer-alley-label' : ''
            }`)
            .attr("x", d => path.centroid(d)[0])         // Set x position at parish center
            .attr("y", d => path.centroid(d)[1])         // Set y position at parish center
            .attr("text-anchor", "middle")               // Center text horizontally
            .attr("dy", "0.35em")                        // Adjust vertical alignment
            .text(d => d.properties.NAME)                // Set text content to parish name
            .style("font-size", "10px")                  // Set font size
            .style("fill", "#333")                       // Set text color (dark gray)
            .style("pointer-events", "none");            // Make labels ignore mouse events

        // Draw Mississippi River path
        g.selectAll(".mississippi")                      // Select all river elements
            .data(topojson.feature(                      // Convert TopoJSON to GeoJSON:
                laRiver,                                 // Using river data
                laRiver.objects.LA_river                 // Specifying feature object
            ).features)                                  // Get features array
            .enter()                                     // Get enter selection
            .append("path")                              // Create path element
            .attr("class", "mississippi")                // Set class for styling
            .attr("d", path)                             // Generate path data
            .attr("fill", "none")                        // No fill (just outline)
            .attr("stroke", "#1f78b4")                   // Set river color (blue)
            .attr("stroke-width", 4)                     // Set river width
            .style("pointer-events", "none");            // Make river ignore mouse events

        // Add Toxic Release Inventory (TRI) site markers
        g.selectAll(".tri-site")                         // Select all TRI site markers
            .data(topojson.feature(                      // Convert TopoJSON to GeoJSON:
                triSites,                                // Using TRI sites data
                triSites.objects.TRI_cancer_perish       // Specifying feature object
            ).features)                                  // Get features array
            .enter()                                     // Get enter selection
            .append("circle")                            // Create circle for each site
            .attr("class", "tri-site")                   // Set class for styling
            .attr("r", 3)                                // Set circle radius
            .attr("transform", function(d) {             // Position circles:
                var coords = projection(                 // Convert geo coordinates to screen
                    d.geometry.coordinates               // Using site's coordinates
                );
                return "translate(" + coords + ")";      // Move circle to position
            })
            .attr("fill", "red")                         // Set circle color
            .attr("opacity", 0.7)                        // Make semi-transparent
            .style("pointer-events", "none");            // Make markers ignore mouse events
    });
}

// Callback function that processes loaded data and creates the visualization
function callback(data) {
    // Extract and transform the loaded datasets
    const homePriceData = data[0];  // Home price data (CSV converted to array of objects)
    const allParishes = topojson.feature(data[1], data[1].objects.LA_county);  // Convert TopoJSON to GeoJSON for parishes

    // Merge home price data with parish geographic features
    allParishes.features = joinData(allParishes.features, homePriceData);
    
    // // Add isCancerAlley flag to each parish's properties
    // allParishes.features.forEach(parish => {
    //     parish.properties.isCancerAlley = cancerAlleyParishes.includes(parish.properties.NAME);  // Boolean flag
    // });

    return {
        homePriceData: homePriceData,
        allParishes: allParishes,
        laRiver: data[2],
        triSites: data[3],
        background_states: data[4]
    };
}

// Joins parish geographic data with home price data by matching parish names
function joinData(parishes, homePriceData) {
    // Transform each parish feature by adding home price data
    return parishes.map(parish => {
        var parishName = parish.properties.NAME; // Get parish name
        
        // Find matching home price record using flexible name matching
        var match = homePriceData.find(d => 
            // Case 1: Direct inclusion match ("Orleans" in "Orleans Parish")
            d.RegionName.includes(parishName) || 
            
            // Case 2: Reverse inclusion after removing " Parish" suffix
            // (Matches "Saint John the Baptist" to "Saint John the Baptist Parish")
            parishName.includes(d.RegionName.replace(" Parish", "")) ||
            
            // Case 3: Handle "St." vs "Saint" variations with Parish suffix removed
            // (Matches "St. James" to "Saint James Parish")
            parishName.replace("St. ", "Saint ") === d.RegionName.replace(" Parish", "")
        );
        
        // Add home_price property to parish features
        parish.properties.home_price = match ? 
            parseFloat(match["2024-12-31"]) : // Convert price string to number
            null; // Null for parishes with no matching price data
            
        return parish; // Return modified feature
    });
}

// Draws background state boundaries on the map
function setStates(background_states, g, path) {
    // Convert TopoJSON to GeoJSON features for states
    var stateFeatures = topojson.feature(background_states, background_states.objects.states).features;

    // Create SVG paths for each state boundary
    g.selectAll(".states")          // Select all existing state elements (empty selection initially)
        .data(stateFeatures)        // Bind state features data
        .enter()                    // Get enter selection for new data
        .append("path")             // Create path element for each state
        .attr("class", "states")    // Add class for styling
        .attr("d", path);           // Generate path data using projection
};

// Creates a quantized color scale for home price visualization
function makeColorScale(data) {
    // Color palette (light yellow to dark brown)
    var colorClasses = [
        '#ffffd4', // Lightest yellow (lowest prices)
        '#fed98e', // Light orange
        '#fe9929', // Medium orange
        '#d95f0e', // Dark orange
        '#993404'  // Darkest brown (highest prices)
    ];

    // Extract and clean price data:
    var prices = data.map(d => parseFloat(d["2024-12-31"]))  // Convert price strings to numbers
                   .filter(d => !isNaN(d));                 // Remove any invalid numbers

    // Create and configure the color scale
    return d3.scaleQuantize()         // Quantize scale splits domain into equal ranges
        .domain(d3.extent(prices))    // Set domain from min to max price
        .range(colorClasses);         // Assign color palette
}

// Creates a color legend visualizing the home price scale
function setLegend(colorScale) {
    // Default configuration for legend appearance
    const config = {
        width: 200,            // Total width of legend SVG
        height: 150,           // Total height of legend SVG
        itemHeight: 25,        // Vertical space per legend item
        fontSize: 12,          // Font size for value labels
        title: "Median Home Prices (2024)", // Legend title text
        titleFontSize: 14,     // Title font size
        margins: {             // Padding around legend content
            top: 20,           // Top margin (extra space for title)
            right: 10, 
            bottom: 10, 
            left: 10
        }
    };
    
    // Clear previous legend and create new SVG container
    const legend = d3.select("#legendContainer")
        .html("")  // Clear existing content
        .append("svg")
        .attr("width", config.width)
        .attr("height", config.height);

    // Add legend title at the top
    legend.append("text")
        .attr("x", config.margins.left)  // Position within margins
        .attr("y", config.margins.top)   // Vertical position
        .text(config.title)
        .style("font-size", config.titleFontSize + "px")
        .style("font-weight", "bold");

    // Get the threshold values and colors from the color scale
    const thresholds = colorScale.thresholds();  // Automatic break points
    const colors = colorScale.range();          // Color palette array

    // Create a legend item for each color in the scale
    colors.forEach((color, i) => {
        // Calculate vertical position for this item
        const yPos = config.margins.top + 20 + (i * config.itemHeight);
        
        // Add color swatch rectangle
        legend.append("rect")
            .attr("x", config.margins.left)    // Align with left margin
            .attr("y", yPos - 15)              // Center vertically with text
            .attr("width", 20)                 // Fixed width swatch
            .attr("height", 20)                // Fixed height swatch
            .attr("fill", color);              // Use current color

        // Calculate value range for this color class
        const minVal = i === 0 
            ? Math.floor(colorScale.domain()[0])  // First class: use min value
            : Math.ceil(thresholds[i-1]);        // Other classes: use previous threshold
            
        const maxVal = i === colors.length - 1
            ? Math.ceil(colorScale.domain()[1])   // Last class: use max value
            : Math.floor(thresholds[i]);         // Other classes: use current threshold

        // Add text label showing the value range
        legend.append("text")
            .attr("x", config.margins.left + 30)  // Right of color swatch
            .attr("y", yPos)                      // Align with swatch
            .text(`$${minVal.toLocaleString()} - $${maxVal.toLocaleString()}`)  // Formatted price range
            .style("font-size", config.fontSize + "px");  // Consistent font size
    });
}
