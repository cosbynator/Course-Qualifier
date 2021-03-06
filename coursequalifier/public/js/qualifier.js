//Includes
var Dom = YAHOO.util.Dom;

//Globals
var loadingDialog = null;
var advancedOptionsOverlay;
var qualifierTable;
var qualifyRequest;
var totalEndTime = 0;

//View stuff
//metrics
function textMetric(metric, instance) { return instance; }
function timeMetric(metric, instance) { return instance.toTimeOfDay(); }
function percentageMetric(metric, instance) {return (instance * 100).toFixed(1) + "%";}
function floatMetric(metric, instance) { return instance.toFixed(2); }
function integerMetric(metric, instance) { return instance; }
function metric(title, key, displayFunc) { return {title: title, key: key, displayFunc: displayFunc};}
catalogMetrics = [
    //[Title, key, rendering function]
    metric("Days of class",        "days_full",      integerMetric),
    metric("Time between classes", "idle_time",      timeMetric),
    metric("Earliest start time",  "earliest_start", timeMetric),
    metric("Latest end time",      "latest_end",     timeMetric),
    metric("Lateness",             "lateness",       percentageMetric)
];

//Section information
function valueFormatter(instance) { 
    if(instance === "" || instance === null || instance === undefined) {
        return false;
    } else {
        return instance;
    }
}

function sectionPrintable(title, key, displayFunc) {return { title: title, key: key, displayFunc: displayFunc};}
sectionPrintables = [
    sectionPrintable("Section Number", "section_num", valueFormatter),
    sectionPrintable("Catalog Number", "class_number", valueFormatter),
    sectionPrintable("Time(s)",        "date_string", valueFormatter),
    sectionPrintable("Room",           "building_room", valueFormatter),
    sectionPrintable("Instructor",     "instructor", valueFormatter),
    sectionPrintable("Enrollment",     "enrollment", valueFormatter)
];


/**
*
*  Base64 encode / decode
*  http://www.webtoolkit.info/
*
**/

var Base64 = {
    // private property
    _keyStr : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",

    // public method for encoding
    encode : function (input) {
        var output = "";
        var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
        var i = 0;

        input = Base64._utf8_encode(input);

        while (i < input.length) {
            chr1 = input.charCodeAt(i++);
            chr2 = input.charCodeAt(i++);
            chr3 = input.charCodeAt(i++);

            enc1 = chr1 >> 2;
            enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
            enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
            enc4 = chr3 & 63;

            if (isNaN(chr2)) {
                enc3 = enc4 = 64;
            } else if (isNaN(chr3)) {
                enc4 = 64;
            }

            output = output +
            this._keyStr.charAt(enc1) + this._keyStr.charAt(enc2) +
            this._keyStr.charAt(enc3) + this._keyStr.charAt(enc4);

        }

        return output;
    },

    // public method for decoding
    decode : function (input) {
        var output = "";
        var chr1, chr2, chr3;
        var enc1, enc2, enc3, enc4;
        var i = 0;

        input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");

        while (i < input.length) {

            enc1 = this._keyStr.indexOf(input.charAt(i++));
            enc2 = this._keyStr.indexOf(input.charAt(i++));
            enc3 = this._keyStr.indexOf(input.charAt(i++));
            enc4 = this._keyStr.indexOf(input.charAt(i++));

            chr1 = (enc1 << 2) | (enc2 >> 4);
            chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
            chr3 = ((enc3 & 3) << 6) | enc4;

            output = output + String.fromCharCode(chr1);

            if (enc3 != 64) {
                output = output + String.fromCharCode(chr2);
            }
            if (enc4 != 64) {
                output = output + String.fromCharCode(chr3);
            }

        }

        output = Base64._utf8_decode(output);

        return output;

    },

    // private method for UTF-8 encoding
    _utf8_encode : function (string) {
        string = string.replace(/\r\n/g,"\n");
        var utftext = "";

        for (var n = 0; n < string.length; n++) {

            var c = string.charCodeAt(n);

            if (c < 128) {
                utftext += String.fromCharCode(c);
            }
            else if((c > 127) && (c < 2048)) {
                utftext += String.fromCharCode((c >> 6) | 192);
                utftext += String.fromCharCode((c & 63) | 128);
            }
            else {
                utftext += String.fromCharCode((c >> 12) | 224);
                utftext += String.fromCharCode(((c >> 6) & 63) | 128);
                utftext += String.fromCharCode((c & 63) | 128);
            }

        }

        return utftext;
    },

    // private method for UTF-8 decoding
    _utf8_decode : function (utftext) {
        var string = "";
        var i = 0;
        var c = c1 = c2 = 0;

        while ( i < utftext.length ) {

            c = utftext.charCodeAt(i);

            if (c < 128) {
                string += String.fromCharCode(c);
                i++;
            }
            else if((c > 191) && (c < 224)) {
                c2 = utftext.charCodeAt(i+1);
                string += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            }
            else {
                c2 = utftext.charCodeAt(i+1);
                c3 = utftext.charCodeAt(i+2);
                string += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }

        }

        return string;
    }

}


String.prototype.zeroPad = function(num) {
    var ret = this;
    while( ret.length < num )
        ret = "0" + ret;
    return ret;
};


Number.prototype.toTimeOfDay = function() {
    return parseInt( this / (60*60)).toString().zeroPad(2) + ":" +  (Math.round(this /60) % 60).toString().zeroPad(2);
};

YAHOO.util.Event.addListener(window, "load", qualifierInit);

function qualifierInit() {
    YAHOO.util.Event.addListener("add_course", "click", addCourse);
    YAHOO.util.Event.addListener("submit_courses", "click", submitCourses);
    YAHOO.util.Event.addListener("show_conflicts", "click", toggleConflicts);
    YAHOO.util.Event.addListener("create_pdf", "click", createPDF);
    YAHOO.util.Event.addListener("select_next_row", "click", selectNextRow);
    YAHOO.util.Event.addListener("select_previous_row", "click", selectPreviousRow);
    YAHOO.util.Event.addListener(document.body, "keyup", checkArrowKeys);
    overlay2 = new YAHOO.widget.Overlay("advanced_options", {
            context:["advanced_options_toggle","bl","br"],
            visible: false,
            width:"400px" 
    });
    overlay2.render();
    YAHOO.util.Event.addListener( "advanced_options_toggle", "click", toggleAdvancedOptions );
}

toggleAdvancedOptions.showing = false;
function toggleAdvancedOptions(e) {
    YAHOO.util.Event.preventDefault(e);
    var root = document.getElementById("course_list" );
    var optionsSection = Dom.getElementsByClassName( "options", "span", root );
    if(toggleAdvancedOptions.showing)  {
        overlay2.hide();
        toggleAdvancedOptions.showing = false;
        for(var i = 0; i < optionsSection.length; i++) {
            optionsSection[i].style.visibility = "hidden";
        }  
    }
    else {
        overlay2.show();
        for(var i = 0; i < optionsSection.length; i++) {
            optionsSection[i].style.visibility = "visible";
        }  
        toggleAdvancedOptions.showing = true;
    }
}

function initLoadingDialog() {
    if(loadingDialog) {
        return;
    }
    loadingDialog = 
            new YAHOO.widget.Panel("loadingDialog",  
                { width:"240px", 
                  fixedcenter:true, 
                  close:false, 
                  draggable:false, 
                  zindex:4,
                  modal:true,
                  visible:false
                } 
            );

    loadingDialog.setHeader("Patience is a virtue...");
    loadingDialog.setBody('<img src="/images/loading.gif" /> <br />'
                        + '<button type="button" id="cancel_button">Cancel</button>'                
    );
    loadingDialog.render(document.body);

    YAHOO.util.Event.addListener( "cancel_button", "click", function(e) {
        YAHOO.util.Connect.abort( qualifyRequest );
        hideLoadingDialog();
    });
}

function showLoadingDialog() {
    initLoadingDialog();
    loadingDialog.show();
}

function hideLoadingDialog() {
    initLoadingDialog();
    loadingDialog.hide();
}

function addCourse(e) {
    YAHOO.util.Event.preventDefault(e);

    var course_list = document.getElementById("course_list");

    var courses =  Dom.getElementsByClassName('course','div', course_list );
    var old_course = courses[courses.length - 1];
    var new_course = old_course.cloneNode( true );
    
    course_list.appendChild( new_course );
}



function getCoursesObject() {
    var course_form = document.getElementById("course_form");
    
    var courses = [];
    var course_nodes = Dom.getElementsByClassName( "course", null, course_form );
    for(var i = 0; i < course_nodes.length; i++) {
        courseObject = serializeFromRoot( course_nodes[i], true );
        optionsSpan = Dom.getChildrenBy( course_nodes[i], function(e) { return e.className == "options"; } )[0]
        courseObject["options"] = serializeFromRoot( optionsSpan, false );
        courses.push( courseObject );
    }

    return courses;
}

function serializeFromRoot(root, first_level) {
    var options = {}
    var inputElements;
    var selectElements;

    if(first_level == true) {
        inputElements = Dom.getChildrenBy( root, function(e) { return e.tagName == "INPUT"; } )
        selectElements= Dom.getChildrenBy( root, function(e) { return e.tagName == "SELECT"; } )
    }
    else {
        inputElements = root.getElementsByTagName("input");
        selectElements = root.getElementsByTagName("select");
    }

    for(i =0; i< inputElements.length; i++)  {
        var option = inputElements[i];
        if( option.name.indexOf( "[]" ) == option.name.length - 2) {
            var name = option.name.substr( 0, option.name.length -2);
            if(options[name] == undefined) {
                options[name] = [];
            }

            options[name].push( option.value );
        }
        else if(option.type == "checkbox") {
            options[option.name] = option.checked;
        }
        else {
            options[ option.name ] = option.value;
        }
    }

    for( i=0; i< selectElements.length; i++ ) {
        var select = selectElements[i];
        var selectChildren = select.getElementsByTagName( "option" );

        for(var j =0;j < selectChildren.length; j++) {
            var option = selectChildren[j];
            if(option.selected) {
                options[ select.name ] = option.value;
            }
        }
    }
    return options;
}

function submitCourses(e)  {
    YAHOO.util.Event.preventDefault(e);

    var course_form = document.getElementById("course_form");
    var advanced_options = document.getElementById("advanced_options");
    var options = serializeFromRoot( advanced_options ); 
    var i = 0;


    var requestObject =  {
        "school": course_form.school.value,
        "term" : course_form.term.value,
        "options" : options,
        "courses": getCoursesObject()
    };

    document.getElementById("error_area").style.display = "none";
    document.getElementById("trace_area").style.display = "none";
    document.getElementById("result_area").style.display = "none";
    document.getElementById("too_many_explanation").style.display = "none";
    document.getElementById("row_select").style.display = "none";
    document.getElementById("show_conflicts").innerHTML = "";
    document.getElementById("show_conflicts_number").innerHTML = "";

    showLoadingDialog();
    hideConflicts();
    var pdfDiv = document.getElementById("create_pdf_div");
    pdfDiv.style.display = "none";
    qualifyRequest = YAHOO.util.Connect.asyncRequest('POST', "/schedule/compute_all", 
                    { 
                        success: qualifyCallback,
                        failure: qualifyErrorCallback
                    },
                    "json=" + escape(YAHOO.lang.JSON.stringify(requestObject)));
}

function displayInfo(infoString) {
    var infoArea = document.getElementById( "info_area" );
    infoArea.innerHTML = "<br />" + infoString.replace( / /g, "&nbsp;" ).replace( /\n/g, "<br />" );
}

function displayErrorHTML(errorHTML) {
    var errorArea = document.getElementById( "error_area" );
    errorArea.innerHTML = errorHTML;
    errorArea.style.display = "block";
}

function displayError(errorString) {
    var errorArea = document.getElementById( "error_area" );
    errorArea.innerHTML = "Errors: <br />" + errorString.replace(/ /g, "&nbsp;" ).replace( /\n/g, "<br />" );
    errorArea.style.display = "block";
}

function handleQualifierError(error) {
    if(error.type == "large_search_space") {
        var tooManyArea   = document.getElementById("too_many_explanation");
        var tooManyNumber = document.getElementById('too_many_number');
        tooManyNumber.innerHTML   = error.size;
        tooManyArea.style.display = "block";
    } else if(error.type == "no_query_results") {
        displayErrorHTML("<h3>No Results</h3> Your query of '" + error.query + "' returned no results.");
    } else if(error.type == "uwdata") {
        displayErrorHTML("<h3>Backend Error</h3> An error occurred in data backend, uwdata.ca, for query '" + error.query + "'." + 
                " This could be because uwdata.ca is down or because it has a bug.");
    } else {
        displayError(YAHOO.lang.dump(error));
    }
}


function qualifyCallback(response) {
    hideLoadingDialog();
    try{
        var data = YAHOO.lang.JSON.parse( response.responseText );
        console.dir(data);
    } catch( e ) {
        displayError( "Invalid response from server: \n" + response.responseText);
        return;
    }

    if(data.error != undefined) {
        handleQualifierError(data.error);
        return;
    }

    if(data.error == undefined && data.exception == undefined) {
        toggleConflicts.conflicts = data.result.conflicts;
        if(data.result.conflicts.length > 0 ) {
            var showConflictsText = document.getElementById( "show_conflicts" );
            var showConflictsNumber = document.getElementById( "show_conflicts_number" ); 
            showConflictsText.innerHTML = "Show conflicting courses";
            showConflictsNumber.innerHTML = "(" + data.result.conflicts.length  + ")";
        }
        if(data.result.catalogs.length == 0) {
            displayError( "No valid schedules found" );
        }
        else {
            createQualifierGrid(data.result );
            selectFirstRow();
            document.getElementById("result_area").style.display = "block";
        }
    }
}

function selectPreviousRow(e) {
    YAHOO.util.Event.preventDefault(e);
    selected = qualifierTable.getSelectedTrEls()[0];
    toSelect = qualifierTable.getPreviousTrEl( selected );
    if(toSelect != null) {
        qualifierTable.unselectAllRows();
        qualifierTable.selectRow( toSelect );
        rowSelected( { target : toSelect }, false );
    }
}

function selectFirstRow() {
    selected = qualifierTable.getSelectedTrEls()[0];
    toSelect =  qualifierTable.getFirstTrEl();
    selectRow(toSelect);
}

function selectRow(trEl) {
    if( trEl != null ) {
        qualifierTable.unselectAllRows();
        qualifierTable.selectRow( toSelect );
        rowSelected( { target : trEl }, false );
    }
}

function selectNextRow(e) {
    YAHOO.util.Event.preventDefault(e);
    selected = qualifierTable.getSelectedTrEls()[0];
    toSelect = qualifierTable.getNextTrEl( selected );
    selectRow(toSelect);
}

function createQualifierGrid(data)  {
    var i;
    var j;
    var columns = [];
    var gridData = [];
    var gridFields = [];

    rowSelected.courses= [];
    rowSelected.metrics = [];
    for(var course in data.courses) {
        var resolved = data.courses[course];
        rowSelected.courses.push( resolved.courseName);
        gridFields.push( resolved.courseName );
    }   

    gridFields.push("id");

    for(i=0; i < catalogMetrics.length; i++) {
        var metric = catalogMetrics[i];
        columns.push({
            key:      metric.key,
            label:    metric.title,
            sortable: true
        });
        gridFields.push(metric);
    }

    for(i=0; i < data.catalogs.length; i++) {
        var catalog = data.catalogs[i];
        var row = {id: i+1};
        for(j=0; j < catalog.sections.length; j++) {
            var section = catalog.sections[j];
            row[section.courseName] = section.sectionName;
        }

        for(j=0; j < catalogMetrics.length; j++) {
            var metric = catalogMetrics[j];
            row[metric.key] = metric.displayFunc(metric, catalog.metrics[metric.key]);
        }

        gridData.push(row);
    }

    var myDataSource = new YAHOO.util.DataSource(gridData);
    myDataSource.responseType = YAHOO.util.DataSource.TYPE_JSARRAY;
    myDataSource.responseSchema = {
        fields: gridFields
    };

    qualifierTable = new YAHOO.widget.DataTable("qualifier_grid", columns, myDataSource, {
            caption: "Click row for schedule details",
            selectionMode: "single"
    }); 
    qualifierTable.subscribe( "rowClickEvent", qualifierTable.onEventSelectRow);
    qualifierTable.subscribe( "rowClickEvent", rowSelected ); 
    qualifierTable.subscribe( "rowMouseoverEvent", qualifierTable.onEventHighlightRow);
    qualifierTable.subscribe( "rowMouseoutEvent", qualifierTable.onEventUnhighlightRow);

    rowSelected.dataTable = qualifierTable;
    rowSelected.responseData =  data;
}

function rowSelected(e, scrollToGrid ) {
    var i;
    var responseData = rowSelected.responseData;
    var rowData =  qualifierTable.getRecord(e.target).getData() ;
    var courses = rowSelected.courses;
    var sections = {};

    for( i = 0; i < courses.length; i++ ) {
        var course = courses[i];
        if( rowData[course] != null ) {
            sections[course] = rowData[course];
        }
    }

    trTarget = qualifierTable.getTrEl(e.target);
    numRows =  qualifierTable.getRecordSet().getLength();
    selectedIndex = qualifierTable.getTrIndex( trTarget ) + 1;

    numberDiv = document.getElementById( "row_select" );
    numberDiv.style.display = "block";
    numberLabel = document.getElementById( "row_select_number" );
    numberLabel.innerHTML = selectedIndex + " / " + numRows;

    createCalendar(responseData.courses, sections);
    createCatalogInformation(rowData, sections, responseData);

    if( scrollToGrid != false ) {
        location.hash = 'none';
        location.hash = 'qualify_calendar_anchor';
    }
}

function createPDF(e) {
    YAHOO.util.Event.preventDefault(e);
    var request = {
        row_data : createPDF.rowData,
        sections: createPDF.sections,
        response_data: createPDF.responseData
    };

    document.pdf_form.ugly_url.value = Base64.encode(YAHOO.lang.JSON.stringify(request));
    document.pdf_form.submit();
}

function createCatalogInformation(rowData, sections, responseData) {
    var i;
    var informationLocation = document.getElementById("catalog_information");
    informationLocation.innerHTML = ""; 

    var pdfDiv = document.getElementById("create_pdf_div");
    pdfDiv.style.display = "block";

    createPDF.rowData = rowData;
    createPDF.sections = sections;
    createPDF.responseData = responseData;

    var courseInfo = document.createElement( "div" );
    courseInfo.setAttribute("class", "course_detail_list");
    courseInfo.innerHTML = "<h3> Courses </h3> ";

    var cNum = 0;
    for(var course in sections) {
        var courseHTML = document.createElement( "div" );
        courseHTML.setAttribute("class", "course_details");
        courseHTML.innerHTML = "<div class='course_detail_name'>" +  course + "</div>";

        var detailedCourse = responseData.courses[course];
        courseHTML.innerHTML += "<div class='course_detail_title'>" +  detailedCourse.title + "</div>";
        var detailedSection = responseData.courses[course].sections[sections[course]];

        for(i = 0; i < sectionPrintables.length; i++) {
            var sectionPrintable = sectionPrintables[i];
            var sectionInfo = detailedSection[sectionPrintable.key];
            var displayValue = sectionPrintable.displayFunc(sectionInfo);
            if(displayValue !== false) {
                courseHTML.innerHTML += "<span class='course_detail_header'>" + sectionPrintable.title + ":</span> " + displayValue + " <br />";
            }
        }

        courseInfo.appendChild( courseHTML );
        cNum++;
        if( cNum % 3 == 0 ) {
            courseInfo.innerHTML += "<div style='clear: both;'> </div>";
        }
    }
    courseInfo.innerHTML += "<div style='clear: both;'> </div>";

    informationLocation.appendChild( courseInfo);
    informationLocation.innerHTML +=  "&nbsp;"; //IE fix
    informationLocation.appendChild( document.createElement( "br" ) );
}

function createCalendar(courseData, sections) {
    var calendarLocation = document.getElementById("qualifier_calendar");
    calendarLocation.innerHTML = "";
    
    var validDays = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];
    var stepSize = 30*60;
    var minStartTime = 9999999;
    var maxEndTime = 0;

    // First pass to determine the "width" and "height" of the table
    for( var section in sections) {
        var sectionInfo = courseData[section].sections[sections[section]];
        var offerings  = sectionInfo.offerings;
        for(var j = 0; j < offerings.length; j++) {
            minStartTime = Math.min(minStartTime, offerings[j].start_time);
            maxEndTime   = Math.max(maxEndTime, offerings[j].end_time);
        }
    }

    var table = document.createElement( "table" );
    var tableBody = document.createElement( "tbody" );
    var tableHeader = document.createElement( "thead" );
    var headerRow  =  document.createElement( "tr" );
    var timeHeader = document.createElement( "th" );
    timeHeader.appendChild( document.createTextNode( "Time" ) );
    headerRow.appendChild( timeHeader );
    for( i =0; i< validDays.length; i++ ) {
        var headerNode = document.createElement( "th" );
        var textNode = document.createTextNode( validDays[i] );
        headerNode.appendChild( textNode );
        headerRow.appendChild( headerNode );
    }
    tableHeader.appendChild( headerRow );
    table.appendChild( tableHeader );

    var realStartTime = 8*60*60;
    var realEndTime = 20*60*60;
        
    if(minStartTime < realStartTime) {
        realStartTime = minStartTime - 2*60*60;
    }
    if(maxEndTime > realEndTime) {
        realEndTime = maxEndTime + 1*60*60;
    }
    if(realEndTime > totalEndTime) {
        totalEndTime = realEndTime;
    } else if (totalEndTime > realEndTime)  {
        realEndTime = totalEndTime;
    }
    
    for(i = realStartTime; i <= realEndTime; i+= stepSize) {
        var row = document.createElement( "tr" );
        var tdNode = document.createElement("td" );
        tdNode.appendChild( document.createTextNode( i.toTimeOfDay() ) );
        tdNode.className = "time";
        row.appendChild( tdNode );
        for( j = 0; j < validDays.length; j++) {
            var tdNode = document.createElement("td" );
            tdNode.innerHTML = "&nbsp;";
            tdNode.className = "empty";
            row.appendChild(  tdNode );
        }
        tableBody.appendChild( row );
    }

    var tableRows = tableBody.childNodes;

    //Second time to fit into the proper bucket
    var startBucket = parseInt( realStartTime / stepSize );
    var endBucket = parseInt( realEndTime / stepSize );
    var i = 0;
    for(var course in sections) {
        var courseInfo = courseData[course];
        var sectionInfo = courseInfo.sections[sections[course]];
        var offerings = sectionInfo.offerings;

        for(j = 0; j < offerings.length; j++) {
            var offering  = offerings[j];
            var startTime = offering.start_time;
            var endTime   = offering.end_time;

            if(startTime && endTime) {
                for( var k = startTime; k <= endTime; k += stepSize ) {
                    var bucket = parseInt(k / stepSize) - startBucket;
                    var cols = tableRows[bucket].childNodes;
                    if(k == startTime) {
                        cols[offering.day + 1].appendChild( document.createTextNode( courseInfo.courseName + " " ) );
                    }
                    else if (k == startTime + stepSize) {
                        cols[offering.day + 1].appendChild( document.createTextNode( sectionInfo.building_room + " " ) );
                    }
                    else {
                        cols[offering.day + 1].appendChild( document.createTextNode(  " " ) );
                    }

                    cols[offering.day + 1].className = "classNum" + i;
                }
            }
        }
        i++;
    }

    table.appendChild( tableBody );
    table.id = "calendarTable";
    table.cellPadding = 0;
    table.cellSpacing = 0;
    calendarLocation.appendChild ( table );

}

function hideConflicts() {
    var conflictDiv = document.getElementById("conflict_area");
    var showConflictsText = document.getElementById( "show_conflicts" );

    if(toggleConflicts.showing) {
        conflictDiv.innerHTML = ""; 
        showConflictsText.innerHTML = "Show conflicting courses";
        toggleConflicts.showing = false; 
    }
}

toggleConflicts.showing = false;

function toggleConflicts(e) {
    YAHOO.util.Event.preventDefault(e);
    if(toggleConflicts.conflicts == undefined) {
        return;   
    }
    var conflictingCourses = toggleConflicts.conflicts;
    var conflictDiv = document.getElementById("conflict_area");
    var showConflictsText = document.getElementById( "show_conflicts" );

    if(toggleConflicts.showing) {
        hideConflicts();
    }
    else {
        var i;
        for(i = 0; i < conflictingCourses.length; i++) {
            var course1 = conflictingCourses[i][0];
            var course2 = conflictingCourses[i][1];

            var newText = document.createTextNode( course1.courseName + " (" + course1.sectionNum + ")"
                            + " conflicts with " + course2.courseName + " (" + course2.sectionNum + ")" );
            conflictDiv.appendChild( newText );
            conflictDiv.appendChild( document.createElement( "br" )  );
        }

        showConflictsText.innerHTML = "Hide conflicting courses";
        toggleConflicts.showing = true; 
    }
}

function qualifyErrorCallback(response) {
   hideLoadingDialog();
   if(response.responseText && response.responseText != "") {
        var traceArea = document.getElementById("trace_area");
        traceArea.innerHTML = response.responseText;
        traceArea.style.display = "block";
   } else {
        displayError( "Error communicating with server"); 
   }
}

function checkArrowKeys(e)  {
    if (totalEndTime == 0) {  // we haven't generated a table yet
        return;
    }
    if (e.keyCode == 37) {
        selectPreviousRow(e);
    }
    else if (e.keyCode == 39) {
        selectNextRow(e);
    }
}
