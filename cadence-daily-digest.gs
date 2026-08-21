/**
 * Network Cadence — Daily Digest
 *
 * Reads your Network Cadence data straight from the hidden Drive app-data
 * folder (the same file the web app syncs to) and emails you a summary if
 * anyone is overdue or coming due soon. Sends nothing on days when
 * everyone's on track.
 *
 * Setup: see the accompanying instructions. In short —
 *  1. Paste this into a new Apps Script project (script.google.com).
 *  2. In the project's manifest (appsscript.json), add the
 *     "https://www.googleapis.com/auth/drive.appdata" and
 *     "https://www.googleapis.com/auth/gmail.send" OAuth scopes.
 *  3. Turn on the "Drive API" advanced service for this project.
 *  4. Run `dailyCadenceCheck` once manually to authorize.
 *  5. Add a time-based trigger (e.g. daily at 8am) calling `dailyCadenceCheck`.
 */

var DATA_FILENAME = 'network-cadence-data.json';
var APP_URL = 'https://cristinadigiacomo.github.io/network-cadence/';

function dailyCadenceCheck() {
  var state = loadCadenceData();
  if (!state) {
    Logger.log('No Network Cadence data file found in appDataFolder yet.');
    return;
  }

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  var overdue = [];
  var soon = [];

  (state.people || []).forEach(function (p) {
    var status = statusFor(p, today);
    if (status === 'overdue') overdue.push(p);
    else if (status === 'soon') soon.push(p);
  });

  if (overdue.length === 0 && soon.length === 0) {
    Logger.log('Nobody overdue or due soon — no email sent.');
    return;
  }

  overdue.sort(function (a, b) { return daysBetween(a.lastContact, today) - daysBetween(b.lastContact, today); });
  soon.sort(function (a, b) { return dueInDays(a, today) - dueInDays(b, today); });

  var subjectBits = [];
  if (overdue.length) subjectBits.push(overdue.length + ' overdue');
  if (soon.length) subjectBits.push(soon.length + ' due soon');
  var subject = 'Network Cadence — ' + subjectBits.join(', ');

  var body = buildEmailBody(overdue, soon, today);
  var recipient = Session.getActiveUser().getEmail();
  MailApp.sendEmail(recipient, subject, body);
}

function loadCadenceData() {
  var files = Drive.Files.list({
    spaces: 'appDataFolder',
    q: "name='" + DATA_FILENAME + "' and trashed=false"
  });
  if (!files.files || files.files.length === 0) return null;

  var fileId = files.files[0].id;
  var url = 'https://www.googleapis.com/drive/v3/files/' + fileId + '?alt=media';
  var resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  return JSON.parse(resp.getContentText());
}

function daysBetween(dateStr, refDate) {
  if (!dateStr) return 999999;
  var a = new Date(dateStr + 'T00:00:00');
  var diff = Math.round((refDate - a) / 86400000);
  return diff;
}

function dueInDays(person, refDate) {
  var elapsed = daysBetween(person.lastContact, refDate);
  return person.cadence - elapsed;
}

function statusFor(person, refDate) {
  if (!person.lastContact) return 'overdue';
  var elapsed = daysBetween(person.lastContact, refDate);
  var remaining = person.cadence - elapsed;
  if (remaining < 0) return 'overdue';
  if (remaining <= 7) return 'soon';
  return 'ok';
}

function buildEmailBody(overdue, soon, today) {
  var lines = [];

  if (overdue.length) {
    lines.push('OVERDUE');
    lines.push('-------');
    overdue.forEach(function (p) {
      var elapsed = daysBetween(p.lastContact, today);
      var daysOver = p.lastContact ? (elapsed - p.cadence) : null;
      var note = p.lastContact
        ? (daysOver + 'd overdue')
        : 'never logged';
      lines.push('- ' + p.name + ' (' + p.category + ') — ' + note);
    });
    lines.push('');
  }

  if (soon.length) {
    lines.push('DUE SOON');
    lines.push('--------');
    soon.forEach(function (p) {
      var remaining = dueInDays(p, today);
      var note = remaining === 0 ? 'due today' : ('due in ' + remaining + 'd');
      lines.push('- ' + p.name + ' (' + p.category + ') — ' + note);
    });
    lines.push('');
  }

  lines.push('Open Network Cadence: ' + APP_URL);
  return lines.join('\n');
}
