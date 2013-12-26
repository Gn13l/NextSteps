var AD = require('AppDev');
var $ = require('jquery');
var ADinstall = require('appdev/install');

module.exports.install = function() {
    return ADinstall.install({
        installDatabases: installDatabases,
        onInstall: onInstall
    });
};

// Called when the app is installed or updated
var onInstall = function(previousVersion) {
    var sortOrder = AD.PropertyStore.get('sort_order');
    if (sortOrder && ADinstall.compareVersions(previousVersion, '1.5') < 0) {
        // The "contact_campus" sort order field was renamed to "campus_label" in version 1.5
        AD.PropertyStore.set('sort_order', sortOrder.map(function(field) {
            return field === 'contact_campus' ? 'campus_label' : field;
        }));
    }
};

// Create the necessary databases for the application
var installDatabases = function(dbVersion) {
    // Create the necessary database tables
    var DataStore = require('appdev/db/DataStoreSQLite');
    var dbName = AD.Defaults.dbName;
    var query = function(query, values) {
        return DataStore.execute(dbName, query, values);
    };

    // This keeps track of whether "install" has been called yet
    var installed = false;
    var install = function() {
        query("CREATE TABLE IF NOT EXISTS site_viewer (\
                   viewer_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                   language_key TEXT DEFAULT 'en',\
                   viewer_passWord TEXT,\
                   viewer_userID TEXT,\
                   viewer_isActive INTEGER DEFAULT 0,\
                   viewer_lastLogin TEXT DEFAULT NULL,\
                   viewer_globalUserID TEXT\
               )");
        
        query("CREATE TABLE IF NOT EXISTS nextsteps_contact (\
                   contact_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                   contact_guid TEXT DEFAULT NULL UNIQUE,\
                   viewer_id INTEGER NOT NULL,\
                   device_id TEXT NOT NULL,\
                   contact_recordId INTEGER,\
                   contact_firstName TEXT NOT NULL,\
                   contact_lastName TEXT NOT NULL,\
                   contact_nickname TEXT,\
                   campus_guid TEXT DEFAULT NULL REFERENCES nextsteps_campus(campus_guid) ON DELETE SET DEFAULT,\
                   year_id INTEGER NOT NULL DEFAULT 1,\
                   contact_phone TEXT,\
                   contact_phoneId TEXT,\
                   contact_email TEXT,\
                   contact_emailId TEXT,\
                   contact_notes TEXT,\
                   contact_preEv TEXT DEFAULT NULL,\
                   contact_conversation TEXT DEFAULT NULL,\
                   contact_Gpresentation TEXT DEFAULT NULL,\
                   contact_decision TEXT DEFAULT NULL,\
                   contact_finishedFU TEXT DEFAULT NULL,\
                   contact_HSpresentation TEXT DEFAULT NULL,\
                   contact_engaged TEXT DEFAULT NULL,\
                   contact_ministering TEXT DEFAULT NULL,\
                   contact_multiplying TEXT DEFAULT NULL\
               )");
        query("CREATE TRIGGER IF NOT EXISTS contact_guid AFTER INSERT ON nextsteps_contact FOR EACH ROW\
               BEGIN\
                   UPDATE nextsteps_contact SET contact_guid = NEW.contact_id||'.'||NEW.device_id WHERE contact_id=NEW.contact_id;\
               END");
        
        query("CREATE TABLE IF NOT EXISTS nextsteps_group (\
                   group_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                   group_guid TEXT DEFAULT NULL UNIQUE,\
                   viewer_id INTEGER NOT NULL,\
                   device_id TEXT NOT NULL,\
                   group_name TEXT NOT NULL,\
                   group_filter TEXT NOT NULL\
               )");
        query("CREATE TRIGGER IF NOT EXISTS group_guid AFTER INSERT ON nextsteps_group FOR EACH ROW\
               BEGIN\
                   UPDATE nextsteps_group SET group_guid = NEW.group_id||'.'||NEW.device_id WHERE group_id=NEW.group_id;\
               END");
        
        query("CREATE TABLE IF NOT EXISTS nextsteps_campus (\
                   campus_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                   campus_guid TEXT DEFAULT NULL UNIQUE,\
                   viewer_id INTEGER NOT NULL,\
                   device_id TEXT NOT NULL,\
                   campus_label TEXT NOT NULL\
               )");
        query("CREATE TRIGGER IF NOT EXISTS campus_guid AFTER INSERT ON nextsteps_campus FOR EACH ROW\
               BEGIN\
                   UPDATE nextsteps_campus SET campus_guid = NEW.campus_id||'.'||NEW.device_id WHERE campus_id=NEW.campus_id;\
               END");
        
        query("CREATE TABLE IF NOT EXISTS nextsteps_year_data (\
                   year_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE\
               )");
        query("CREATE TABLE IF NOT EXISTS nextsteps_year_trans (\
                   trans_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                   year_id INTEGER NOT NULL DEFAULT 1,\
                   language_code TEXT NOT NULL DEFAULT '',\
                   year_label TEXT NOT NULL\
               )");
        // Empty the tables and recreate the year labels
        query("DELETE FROM nextsteps_year_data");
        query("DELETE FROM nextsteps_year_trans");
        var yearLabels = ['Unknown', 'Freshman', 'Sophmore', 'Junior', 'Senior', 'Graduated', 'Teacher', 'Other'];
        yearLabels.forEach(function(yearLabel, index) {
            var id = index + 1;
            query("INSERT INTO nextsteps_year_data (year_id) VALUES (?)", [id]);
            query("INSERT INTO nextsteps_year_trans (trans_id, year_id, language_code, year_label) VALUES (?, ?, 'en', ?)", [id, id, yearLabel]);
        });
        
        query("CREATE TABLE IF NOT EXISTS nextsteps_tag (\
                   tag_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                   tag_guid TEXT DEFAULT NULL UNIQUE,\
                   viewer_id INTEGER NOT NULL,\
                   device_id TEXT NOT NULL,\
                   tag_label TEXT NOT NULL\
               )");
        query("CREATE TRIGGER IF NOT EXISTS tag_guid AFTER INSERT ON nextsteps_tag FOR EACH ROW\
               BEGIN\
                   UPDATE nextsteps_tag SET tag_guid = NEW.tag_id||'.'||NEW.device_id WHERE tag_id=NEW.tag_id;\
               END");
        query("CREATE TABLE IF NOT EXISTS nextsteps_contact_tag (\
                   contacttag_id INTEGER PRIMARY KEY AUTOINCREMENT UNIQUE,\
                   contacttag_guid TEXT DEFAULT NULL UNIQUE,\
                   viewer_id INTEGER NOT NULL,\
                   device_id TEXT NOT NULL,\
                   contact_guid TEXT NOT NULL REFERENCES nextsteps_contact(contact_guid) ON DELETE CASCADE,\
                   tag_guid TEXT NOT NULL REFERENCES nextsteps_tag(tag_guid) ON DELETE CASCADE\
               )");
        query("CREATE TRIGGER IF NOT EXISTS contacttag_guid AFTER INSERT ON nextsteps_contact_tag FOR EACH ROW\
               BEGIN\
                   UPDATE nextsteps_contact_tag SET contacttag_guid = NEW.contacttag_id||'.'||NEW.device_id WHERE contacttag_id=NEW.contacttag_id;\
               END");
        
        installed = true;
    };
    
    
    // Installed, but pre-1.1
    if (ADinstall.compareVersions(dbVersion, '0') > 0 && ADinstall.compareVersions(dbVersion, '1.1') < 0) {
        // Upgrade pre-1.1 databases
        
        // Rename the nextsteps_contact and nextsteps_group tables so they will be recreated
        query("ALTER TABLE nextsteps_contact RENAME TO nextsteps_contact_temp");
        query("ALTER TABLE nextsteps_group RENAME TO nextsteps_group_temp");
        
        install();
        
        // Add back a field that was removed to allow the upgrade to version 1.1 to proceed
        // It will be removed again during the upgrade to version 1.5
        query("ALTER TABLE nextsteps_contact ADD COLUMN contact_campus TEXT");
        
        // After recreating the contact and group tables, copy the data back in
        var contactFields = 'contact_id, viewer_id, contact_recordId, contact_firstName, contact_lastName, contact_nickname, contact_campus, year_id, contact_phone, contact_phoneId, contact_email, contact_emailId, contact_notes, contact_preEv, contact_conversation, contact_Gpresentation, contact_decision, contact_finishedFU, contact_HSpresentation, contact_engaged, contact_ministering, contact_multiplying';
        query("INSERT INTO nextsteps_contact ("+contactFields+", contact_guid, device_id) SELECT "+contactFields+", contact_id, ? FROM nextsteps_contact_temp", [Ti.Platform.id]);
        var groupFields = 'group_id, viewer_id, group_name, group_filter';
        query("INSERT INTO nextsteps_group ("+groupFields+", group_guid, device_id) SELECT "+groupFields+", group_id, ? FROM nextsteps_group_temp", [Ti.Platform.id]);
        
        // Populate guid values
        query("UPDATE nextsteps_contact SET contact_guid = contact_id||'.'||device_id");
        query("UPDATE nextsteps_group SET group_guid = group_id||'.'||device_id");
        
        // Contact year_id is now a 1-based index, rather than a 0-based index
        query("UPDATE nextsteps_contact SET year_id = year_id+1");
        
        // Now contact_recordId of NULL, rather than -1, refers to a contact not in the address book
        query("UPDATE nextsteps_contact SET contact_recordId = NULL WHERE contact_recordId = -1");
        
        query("DROP TABLE nextsteps_contact_temp");
        query("DROP TABLE nextsteps_group_temp");
    }
    // Installed, but pre-1.5
    if (ADinstall.compareVersions(dbVersion, '0') > 0 && ADinstall.compareVersions(dbVersion, '1.5') < 0) {
        // Upgrade pre-1.5 databases
        
        // Rename the nextsteps_contact and nextsteps_group tables so they will be recreated
        query("ALTER TABLE nextsteps_contact RENAME TO nextsteps_contact_temp");
        query("DROP TRIGGER IF EXISTS contact_guid");
        query("ALTER TABLE nextsteps_group RENAME TO nextsteps_group_temp");
        query("DROP TRIGGER IF EXISTS group_guid");
        
        install();
        
        // After recreating the nextsteps_contact and nextsteps_group tables, copy contact and group data back in
        var fields = 'contact_id, contact_guid, viewer_id, device_id, contact_recordId, contact_firstName, contact_lastName, contact_nickname, year_id, contact_phone, contact_phoneId, contact_email, contact_emailId, contact_notes, contact_preEv, contact_conversation, contact_Gpresentation, contact_decision, contact_finishedFU, contact_HSpresentation, contact_engaged, contact_ministering, contact_multiplying';
        query("INSERT INTO nextsteps_contact ("+fields+") SELECT "+fields+" FROM nextsteps_contact_temp");
        query("INSERT INTO nextsteps_group SELECT * FROM nextsteps_group_temp");

        // Load the campus labels from the property store
        var campuses = AD.PropertyStore.get('campuses').map(function(campusLabel) {
            return {
                campus_label: campusLabel
            };
        });
        // Fill the nextsteps_campus table with the defined campuses
        campuses.forEach(function(campus) {
            // Create a new campus
            query("INSERT INTO nextsteps_campus (viewer_id, device_id, campus_label) VALUES (?, ?, ?)", [AD.Defaults.viewerId, Ti.Platform.id, campus.campus_label]).done(function(campus_id) {
                // Get the campus_guid of the campus just created and find all the contacts that reference this campus
                var getCampusGuid = query("SELECT campus_guid FROM nextsteps_campus WHERE campus_id=?", [campus_id]);
                var getContacts = query("SELECT contact_id FROM nextsteps_contact_temp WHERE contact_campus=?", [campus.campus_label]);
                $.when(getCampusGuid, getContacts).done(function(campusArgs, contactArgs) {
                    // Now update all the contacts that referenced this campus
                    var campus_guid = campus.campus_guid = campusArgs[0][0].campus_guid;
                    var contact_ids = contactArgs[0].map(function(row) { return row.contact_id; });
                    query("UPDATE nextsteps_contact SET campus_guid=? WHERE contact_id IN ("+contact_ids.join(',')+")", [campus_guid]);
                });
            });
        });
        AD.PropertyStore.remove('campuses');

        // Update the group filters to reference campuses by guid, rather than by label
        query("SELECT group_guid,group_filter FROM nextsteps_group").done(function(groupArgs) {
            var indexedCampuses = $.indexArray(campuses, 'campus_label');
            var groups = groupArgs[0];
            groups.forEach(function(group) {
                var filter = JSON.parse(group.group_filter);
                if (filter.contact_campus) {
                    filter.campus_guid = indexedCampuses[filter.contact_campus].campus_guid;
                    delete filter.contact_campus;
                }
                query("UPDATE nextsteps_group SET group_filter = ? WHERE group_guid = ?", [JSON.stringify(filter), group.group_guid]);
            });
        });

        query("DROP TABLE nextsteps_contact_temp");
        query("DROP TABLE nextsteps_group_temp");
    }
    if (!installed) {
        // Run "install" if it has not been run yet
        install();
    }
};
