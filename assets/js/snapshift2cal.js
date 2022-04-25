var datass = '';
var DataArr = [];
var employeeIndex = 0;
var arrayWeekDays = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
var companyName = '';
PDFJS.workerSrc = '';
var employeesPlanning = [];
moment.locale('fr');


function ExtractText() {
    var input = document.getElementById("file-id");
    var fReader = new FileReader();
    fReader.readAsDataURL(input.files[0]);
    fReader.onloadend = function (event) {
        convertDataURIToBinary(event.target.result);
    }
}

var BASE64_MARKER = ';base64,';

function convertDataURIToBinary(dataURI) {

    var base64Index = dataURI.indexOf(BASE64_MARKER) + BASE64_MARKER.length;
    var base64 = dataURI.substring(base64Index);
    var raw = window.atob(base64);
    var rawLength = raw.length;
    var array = new Uint8Array(new ArrayBuffer(rawLength));

    for (var i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
    }
    pdfAsArray(array)

}


function downloadCalendar(index)
{
    let nDate = new Date();
    let eventUID = nDate.getTime();

    let cal = ics(eventUID);
       

    if(typeof employeesPlanning[index] != 'undefined') {
        let events = employeesPlanning[index].events;
        let recapString = '';

        for (let j = 0; j < events.length; j++) {
            let event = events[j];
            cal.addEvent(companyName, 'Pause : '+event.pause+'min', event.etab, event.start.format('YYYY-MM-DD HH:mm'), event.end.format('YYYY-MM-DD HH:mm'));
        }

        filename = employeesPlanning[index].name.replace(' ', '_')+'_calendar';
        cal.download(filename);
    }
}

function getPageText(pageNum, PDFDocumentInstance) {
    // Return a Promise that is solved once the text of the page is retrieven
    return new Promise(function (resolve, reject) {
        PDFDocumentInstance.getPage(pageNum).then(function (pdfPage) {
            // The main trick to obtain the text of the PDF page, use the getTextContent method
            pdfPage.getTextContent().then(function (textContent) {
                var textItems = textContent.items;
                var finalString = "";
                var beforeEmployeeName = false, gotEmployeeName = false, $isWeekDay = false, $gotEtab = false, $prevIsHours = false;
                var tmpStr = '', start, end, tmpDate;

                for (var i = 0; i < textItems.length; i++) {
                    var item = textItems[i];
                    tmpStr = item.str;

                    if(beforeEmployeeName) {
                        employeesPlanning[employeeIndex] = [];
                        employeesPlanning[employeeIndex]['name'] = tmpStr;
                        employeesPlanning[employeeIndex]['events'] = [];
                        beforeEmployeeName = false; 
                    } else {
                        if(tmpStr.indexOf('Salar') > -1) { 
                            beforeEmployeeName = true; 
                            companyName = textItems[i-1].str;
                        } else {
                            if($isWeekDay) {
                                tmpStr = tmpStr;
                                start = moment(tmpDate+' '+tmpStr.substring(0, 5));
                                pause = '';

                                if(tmpStr.substring(7, 12).trim() == '0.00') {
                                    end = moment(tmpDate+' 00h00');
                                } else {
                                    end = moment(tmpDate+' '+tmpStr.substring(8, 13));
                                    pause = tmpStr.substring(tmpStr.indexOf('(')+1, tmpStr.indexOf(')'));
                                }

                                if(start.isValid() && end.isValid()) {
                                    if(typeof employeesPlanning[employeeIndex] != 'undefined') {
                                        employeesPlanning[employeeIndex]['events'].push(
                                            {
                                                'start' : start, 
                                                'end': end,
                                                'pause': pause
                                            }
                                        );
                                        $prevIsHours = true;
                                    }
                                }
                                
                                $isWeekDay = false;
                                $gotEtab = false;
                                tmpDate = '';
                            } else {
                                if(arrayWeekDays.indexOf(tmpStr.substring(0, 3)) > -1) {
                                    $isWeekDay = true;
                                    tmpDate = tmpStr.substring(3).trim().split('/');
                                    tmpDate = '20'+tmpDate[2]+'-'+tmpDate[1]+'-'+tmpDate[0];
                                } 
                                else if ($prevIsHours && !$gotEtab 
                                    && (tmpStr.indexOf('-') === -1 && tmpStr.indexOf('(') === -1 
                                    && tmpStr.indexOf(')') === -1 && tmpStr.indexOf('0.00') === -1))
                                {
                                    $etab = tmpStr;
                                    if(employeesPlanning[employeeIndex]['events'].length > 0) {
                                        employeesPlanning[employeeIndex]['events'][employeesPlanning[employeeIndex]['events'].length-1]['etab'] = tmpStr;
                                        $gotEtab = true;
                                        $prevIsHours = false;
                                    }
                                }
                            }                                    
                        }
                    }
                }
                employeeIndex++;
                resolve(employeesPlanning);
            });
        });
    });
}

function pdfAsArray(pdfAsArray) {

    PDFJS.getDocument(pdfAsArray).then(function (pdf) {

        var pdfDocument = pdf;
        // Create an array that will contain our promises
        var pagesPromises = [];

        for (var i = 0; i < pdf.pdfInfo.numPages; i++) {
            // Required to prevent that i is always the total of pages
            (function (pageNumber) {
                // Store the promise of getPageText that returns the text of a page
                pagesPromises.push(getPageText(pageNumber, pdfDocument));
            })(i + 1);

        }

        // Execute all the promises
        Promise.all(pagesPromises).then(function (pagesText) {
            $('#table').css('display', 'table');
            $('#company-title').css('display', 'inline-block');
            $('#company-name').html(companyName);
            $('#import-container').css('display', 'none');

            for (let i = 0; i < employeesPlanning.length; i++) {
                if(typeof employeesPlanning[i] != 'undefined') {
                    let events = employeesPlanning[i].events;
                    let recapString = '';

                    for (let j = 0; j < events.length; j++) {
                        let event = events[j];
                        recapString += event.start.format('DD/MM/YYYY HH:mm')
                        +' - '+event.end.format('DD/MM/YYYY HH:mm')
                        +' | Pause : '+event.pause+'min'
                        +' | Etablissement : '+event.etab
                        +'<br />';
                    }

                    let row = '<tr>'
                    +'<td>'+employeesPlanning[i].name+'</td>'
                    +'<td>'+recapString+'</td>'
                    +'<td><button class="btn-calendar" onclick="downloadCalendar('+i+');"><img src="assets/img/calendar.png" /></button></td>';
                    +'</tr>';

                    $('#table tbody').append(row);

                }
            }
            
        });

    }, function (reason) {
        // PDF loading error
        console.error(reason);
    });
}
