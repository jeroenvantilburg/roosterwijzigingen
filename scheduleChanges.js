// License

// All code runs in this anonymous function
// to avoid cluttering the global variables
(function() {

  $('#toggleRaw').on( 'click', function(e) {
    $('#table-raw').toggle();
    if( $('#toggleRaw').is(":visible") ) {
      $('#toggleRaw').html("Hide raw table");
    } else {
      $('#toggleRaw').html("Show raw table");
    }
  });

  $('#toggleAuth').on( 'click', function(e) {
    $('#auth').toggle();
  });

  $('#toggleSettings').on( 'click', function(e) {
    $('#settings').toggle();
  });


  let now = new Date();
  let dateString = getDate(now);
  let dateStringISO = getDateISO(now);
  $("#dateString").html(dateString);
  $("#date").val( dateStringISO );
  $("#modSince").val( dateStringISO );

  let startTime = new Date(dateStringISO).setHours(0, 0, 0, 0) / 1000;
  let endTime = new Date(dateStringISO).setHours(24, 0, 0, 0) / 1000;

  //const modtime = Math.round(new Date('2023-12-05').getTime() / 1000);

  let modtime = startTime;

  console.log(modtime);


  // Get token from the local storage
  const tokenKey = 'zermeloToken';
  let token = localStorage.getItem(tokenKey);
  let school = token.split(' ')[1];
  token = token.split(' ')[0];
  console.log(token);
  console.log(school);
  let url = `https://${school}.zportal.nl/api/v3/`;
  console.log(`You're logged in into: ${url}`);
  if( school == ""  || !token || token.length != 26 ) {
    console.log("Token not yet stored");
    $('#auth').show();
  } else {
    getSchedule();
  }

  $('#login').on( 'click', function(e) {
    school = $("#school").val();
    API_key = $("#API_key").val().replace(/\s/g, '');
    token = $("#token").val();
    if( !token || token.length != 26 ) {
      getToken(school, API_key).then(r => {
          console.log("tot hier");
          token = localStorage.getItem(tokenKey).split(' ')[0];
          console.log(token);
          $('#auth').hide();
          getSchedule();
      }).catch( e => {
        $("#loginError").html("Wrong school or koppel code");
        console.log("Authentication failed: wrong school or koppel code");
      });
    } else {
      localStorage.setItem(tokenKey, `${token} ${school}`);
      getSchedule();  
    }
  });

  $('#getSchedule').on( 'click', function(e) {
    let newDate = $("#date").val();
    startTime = new Date(newDate).setHours(0, 0, 0, 0) / 1000;
    endTime = new Date(newDate).setHours(24, 0, 0, 0) / 1000;
    let dateString = getDate(newDate);
    $("#dateString").html(dateString); 
    
    let modSince = $("#modSince").val();
    modtime = new Date(modSince).setHours(0, 0, 0, 0) / 1000;

    getSchedule();  
  });


  async function getToken(school, authKey) {
      url = `https://${school}.zportal.nl/api/v3/`;

      /*const response = await axios.post(`${url}oauth/token?grant_type=authorization_code&code=${API_key}` );
      const accessToken = response.data.access_token;
      console.log(accessToken);
      localStorage.setItem(tokenKey, `${accessToken} ${school}`);*/
      return axios.post(`${url}oauth/token?grant_type=authorization_code&code=${API_key}` )
      .then( (response) => {
        const accessToken = response.data.access_token;
        console.log(accessToken);
        localStorage.setItem(tokenKey, `${accessToken} ${school}`);  
        console.log( localStorage[tokenKey] ) ;
      });

      //return accessToken;
  }


  // check a instance
  /*axios.get(`${url}appointments?access_token=${token}&appointmentInstance=2048440`)
    .then(response => {
      const appointments = response.data.response.data;
      console.log(appointments);
  });
    */

  function getSchedule() {
    /*axios.get(`${url}announcements?access_token=${token}&start=${modtime}&end=${endTime}`)
      .then(response => {
        const announcements = response.data.response.data;
        console.log(response);
        console.log(announcements);
      });
    */
    axios.get(`${url}appointments?access_token=${token}&includeHidden=true&start=${startTime}&end=${endTime}&appointmentModifiedSince=${modtime}`)
      .then(response => {
        const appointments = response.data.response.data;

        appointments.sort((a, b) => {
          let aGroup = a.groups.length > 0 ? a.groups[0].match(/\d+/)[0] : 0;
          let bGroup = b.groups.length > 0 ? b.groups[0].match(/\d+/)[0] : 0;
          return a.start - b.start ||
                 aGroup - bGroup;
         });

        /*console.table(appointments.map(appointment => ({
          Day: new Date(appointment.start * 1000).toLocaleDateString(),
          Timeslot: appointment.startTimeSlot,
          Teacher: appointment.teachers.join(', '),
          Subject: appointment.subjects.join(', '),
          Location: appointment.locations.join(', '),
          Desc: appointment.changeDescription,
          Cancelled: appointment.cancelled.toString(),
        })));*/

        let filter = function(obj, idx, arr) {
          return !(obj.type == "activity" || 
                  (obj.subjects[0] == "stu" && obj.groups.length === 0 ) ||
                   obj.hidden ||
                  //obj.changeDescription === "" ||
                  (!obj.valid && arr.some( l => {
                    return obj.appointmentInstance == l.appointmentInstance && 
                            l.start == obj.start && l.valid;})) //||
                  //(obj.valid && !arr.some( l => {
                  //  return obj.appointmentInstance == l.appointmentInstance && 
                  //         l.start == obj.start && !l.valid;}))          
                  );
        }

        const appointmentsFiltered = appointments.filter(filter);

        let headers = {startTimeSlot: "Uur", groups: "Klas", subjects: "Vak", 
                      locations: "Lokaal", teachers : "Docent", 
                      changeDescription: "Omschrijving"};
        const tableFiltered = createTableFromObjects(appointmentsFiltered, headers);
        const tableFilteredContainer = document.getElementById('table-filtered');
        tableFiltered.className = "Filtered";
        tableFilteredContainer.replaceChildren(tableFiltered);

        const table = createTableFromObjects(appointments);
        const tableContainer = document.getElementById('table-raw');
        tableContainer.replaceChildren(table);

      })
      .catch(error => {
        $("#auth").show();
        console.error(error);
      });
  }



  function createTableFromObjects(data, headers={}) {
    const table = document.createElement('table');
    const headerRow = document.createElement('tr');
    
    // Create table header row
    const emptyHeaders = (Object.keys(headers).length === 0 && data.length !== 0 )
    const keys = emptyHeaders ? Object.keys(data[0]) : Object.keys(headers);
    for (const key of keys) {
      const headerCell = document.createElement('th');
      headerCell.textContent = emptyHeaders ? key : headers[key];
      headerCell.className = headerCell.textContent;
      headerRow.appendChild(headerCell);
    }
    table.appendChild(headerRow);

    // Create table data rows
    for (const obj of data) {
      //if( !isToday( obj.start ) ) continue;
      const dataRow = document.createElement('tr');
      for (const key of keys) {
        const dataCell = document.createElement('td');
        if( key == "start" || key == "end" ) {
          dataCell.textContent = getTime( obj[key]*1000 )
        } else if (key == "created" || key == "lastModified" ) {
          dataCell.textContent = getTime( obj[key]*1000 ) + " " + getDate( obj[key]*1000);
        } else {
          dataCell.textContent = obj[key];
        }

        if ( !emptyHeaders ) {
          if( key == "groups"  && obj[key].length > 1 ) {
            dataCell.textContent = obj[key].map( l =>  l.substring(0,2) );
          }
          if( key == "changeDescription") {
            if( obj[key] === "" && !obj.valid ) {dataCell.textContent = "Deze les is vervallen !!! "; }
            dataCell.textContent += " " + obj.remark;
          }
          if( key == "startTimeSlot" && obj[key] == null ) {
            dataCell.textContent = getTime( obj.start*1000 );
          }
        }
        dataRow.appendChild(dataCell);
      }
      table.appendChild(dataRow);
    }

    return table;
  }

  function getTime( unixTime ) {
    return (new Date(unixTime)).toLocaleTimeString(undefined, 
      { hour:   '2-digit',
        minute: '2-digit'}  );
  }

  function getDate( unixTime ) {
    return (new Date(unixTime)).toLocaleDateString(undefined, 
            { day:   '2-digit',
              month: 'short'}  );
  }

  function getDateISO( unixTime ) {
    let day = ("0" + unixTime.getDate()).slice(-2);
    let month = ("0" + (unixTime.getMonth() + 1)).slice(-2);
    return unixTime.getFullYear()+"-"+(month)+"-"+(day) ;
  }

  function isToday( unixTime ) {
    let today = new Date().setHours(0, 0, 0, 0);
    let thatDay = new Date(unixTime*1000).setHours(0, 0, 0, 0);
    if(today === thatDay) return true;
    else return false;
  }


})();