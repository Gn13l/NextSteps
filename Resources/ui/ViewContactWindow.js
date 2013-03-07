var AD = require('AppDev');
var $ = require('jquery');

module.exports = $.Window('AppDev.UI.ViewContactWindow', {
    dependencies: ['AddContactWindow', 'DatePickerWindow', 'Checkbox'],
    
    contactMethods: [
        {label: 'contact_call', callback: 'callContact', field: 'contact_phone'},
        {label: 'contact_SMS', callback: 'SMSContact', field: 'contact_phone'},
        {label: 'contact_email', callback: 'emailContact', field: 'contact_email'}
    ],
    actions: [{
        title: 'edit',
        callback: function() {
            // Open the EditContact window
            var $winAddContactWindow = new AD.UI.AddContactWindow({tab: this.options.tab, operation: 'edit', existingContact: this.contact});
        },
        rightNavButton: true
    }, {
        title: 'del',
        callback: function() {
            // Close the window and delete the group
            this.dfd.reject();
            this.contact.destroy();
        },
        platform: 'Android'
    }, {
        callback: function() {
            if (this.contactModified) {
                // When the window is closed, if any of the contact's attributes have
                // changed, save the updated contact information to the database
                this.contact.save();
            }
        },
        menuItem: false,
        onClose: true
    }]
}, {
    init: function(options) {
        this.contact = this.options.contact;
        this.contactModified = false;
        
        // Initialize the base $.Window object
        this._super({
            title: 'viewContact',
            tab: this.options.tab,
            autoOpen: true
        });
        
        this.smartBind(this.contact, 'updated.attr', function(property, value) {
            // Re-initialize the name label and contact buttons
            this.initialize();
            
            // Simulate a global model 'updated' event
            $(this.contact.constructor).trigger('updated', this.contact);
        });
    },
    
    // Create the child views
    create: function() {
        var contact = this.contact;
        
        // Show the contact's image if it exists
        var localContact = contact.contact_recordId === null ? null : Ti.Contacts.getPersonByID(contact.contact_recordId);
        var contactImage = localContact && localContact.getImage();
        var imageExists = contactImage ? true : false;
        if (imageExists) {
            var dimensions = AD.UI.getImageScaledDimensions(contactImage, AD.UI.contactImageSize);
            this.add('contactImage', Ti.UI.createImageView({
                left: AD.UI.padding,
                top: AD.UI.padding,
                width: dimensions.width,
                height: dimensions.height,
                image: contactImage
            }));
        }
        
        // Create the contact label 
        var nameLabel = this.add('nameLabel', Ti.UI.createLabel({
            left: AD.UI.padding + (imageExists ? AD.UI.contactImageSize.width : 0),
            top: AD.UI.padding,
            width: AD.UI.useableScreenWidth - (imageExists ? AD.UI.contactImageSize.width : 0),
            height: Ti.UI.SIZE,
            text: null,
            textAlign: 'center',
            font: AD.UI.Fonts.header
        }));
        
        var headerHeight = imageExists ? AD.UI.contactImageSize.height : 40;
        var bodyTop = headerHeight + AD.UI.padding;
        
        // Create the contact button bar which allows the user to call, SMS, or e-mail the contact
        if (AD.Platform.isiOS) {
            // Create a button bar under iOS
            this.contactBBLabels = this.constructor.contactMethods.map(function(method) {
                return $.extend({
                    title: AD.Localize(method.label)
                }, method);
            });
            var contactBB = this.add('contactBB', Ti.UI.createButtonBar({
                left: AD.UI.padding,
                top: bodyTop,
                width: AD.UI.useableScreenWidth,
                height: AD.UI.buttonHeight,
                style: Ti.UI.iPhone.SystemButtonStyle.BAR,
                labels: this.contactBBLabels
            }));
            contactBB.addEventListener('click', this.proxy(function(event) {
                var callbackName = this.constructor.contactMethods[event.index].callback;
                // callbackName will be undefined if event.index is null
                // because the user clicked the button bar, but not a button
                if (typeof callbackName !== 'undefined') {
                    // Determine the proper callback to use and call it
                    var callback = $.isFunction(callback) ? callback : this[callbackName];
                    callback.call(this);
                }
            }));
        }
        else {
            // Create muliple buttons under any other platform
            
            // The buttons are spaced evenly and horizontally with AD.UI.padding units of padding between them
            var buttonWidth = AD.UI.useableScreenWidth / this.constructor.contactMethods.length - AD.UI.padding; 
            this.constructor.contactMethods.forEach(function(method, index) {
                var button = this.add(method.label, Ti.UI.createButton($.extend({
                    top: bodyTop,
                    left: AD.UI.padding + buttonWidth * index + AD.UI.padding / 2,
                    width: buttonWidth,
                    height: AD.UI.buttonHeight,
                    titleid: method.label
                }, method)));
                button.addEventListener('click', this.proxy(method.callback));
            }, this);
        }
        
        // Create the steps view
        var $stepsView = $.View.create(Ti.UI.createScrollView({
            top: bodyTop + AD.UI.buttonHeight + AD.UI.padding,
            left: 0,
            scrollType: 'vertical',
            contentHeight: 'auto',
            showVerticalScrollIndicator: true
        }));
        var rowHeight = AD.UI.buttonHeight;
        var rowCount = 0;
        var _this = this;
        $.each(AD.Models.Contact.steps, function(stepName, stepFieldName) {
            var $newRow = $.View.create(Ti.UI.createView({
                left: 0,
                top: rowCount * rowHeight,
                height: rowHeight,
                borderWidth: 1,
                borderColor: 'black'
            }));
            ++rowCount;
            
            // Create the step title
            $newRow.add(Ti.UI.createLabel({
                top: AD.UI.padding,
                left: AD.UI.padding,
                width: AD.UI.useableScreenWidth,
                height: Ti.UI.SIZE,
                textid: 'step_'+stepName,
                font: AD.UI.Fonts.medium
            }));
            
            var stepCompletedDate = contact.attr(stepFieldName);
            var stepCompleted = stepCompletedDate !== null;
            
            // Create the switch to toggle the step's completion status
            var $completedCheckbox = new AD.UI.Checkbox({
                createParams: {
                    right: AD.UI.padding
                },
                value: stepCompleted
            });
            var completedCheckbox = $completedCheckbox.getView();
            completedCheckbox.addEventListener('change', function(event) {
                // The step's completion state has been changed
                stepCompleted = event.value;
                stepCompletedDate = stepCompleted ? $.today() : null;
                contact.attr(stepFieldName, stepCompletedDate);
                _this.contactModified = true;
                updateRow();
            });
            $newRow.add($completedCheckbox);
            
            // Create the button to set the step completion date
            var dateButton = Ti.UI.createButton({
                right: AD.UI.Checkbox.defaultSize + AD.UI.padding * 2,
                width: AD.Platform.isiOS ? 90 : 60,
                height: AD.UI.buttonHeight,
                title: ''
            });
            dateButton.addEventListener('click', function() {
                // Set the completion date of the step
                AD.UI.DatePickerWindow.datePicker({
                    tab: _this.options.tab,
                    minDate: new Date(2012, 0, 1), // January 1, 2012
                    maxDate: $.today(),
                    initialDate: stepCompletedDate
                }).done(function(completedDate) {
                    stepCompletedDate = completedDate;
                    contact.attr(stepFieldName, stepCompletedDate);
                    _this.contactModified = true;
                    updateRow();
                });
            });
            $newRow.add(dateButton);
            
            // Update the checkbox image and the title and visibility of the dateButton
            var updateRow = function() {
                if (stepCompleted) {
                    dateButton.visible = true;
                    dateButton.title = $.formatDate(stepCompletedDate);
                }
                else {
                    dateButton.visible = false;
                }
            };
            updateRow();
            
            $stepsView.add(stepFieldName, $newRow);
        });
        this.add($stepsView);
    },
    
    // Initialize the child views
    initialize: function() {
        this.getChild('nameLabel').text = this.contact.getLabel();
        
        // Update the enabled status of each of the contact buttons
        
        // Extract the button array
        var buttons = AD.Platform.isiOS ? this.contactBBLabels : this.constructor.contactMethods.map(function(method) {
            return this.getChild(method.label);
        }, this);
        buttons.forEach(function(button) {
            button.enabled = this.contact.attr(button.field) ? true : false;
            console.log('button = '+JSON.stringify(button));
            //console.log('button.enabled = '+button.enabled);
        }, this);
        if (AD.Platform.isiOS) {
            // Force the button bar to recognize the new button states
            this.getChild('contactBB').labels = buttons;
        }
    },
    
    // Helper functions that allow the user to contact the contact via telephone, SMS, or e-mail
    callContact: function() {
        // Remove all non-numeric numbers from the phone number
        var strippedPhoneNumber = this.contact.contact_phone.replace(/\D/g, '');
        Ti.Platform.openURL('tel:'+strippedPhoneNumber); // tel:xxxxxxxx format
        if (AD.Platform.isiOS) {
            Ti.App.iOS.registerBackgroundService({ url: 'Return.js' });
        }
    },
    SMSContact: function() {
        // Remove all non-numeric numbers from the phone number
        var strippedPhoneNumber = this.contact.contact_phone.replace(/\D/g, '');
        Ti.Platform.openURL('sms:'+strippedPhoneNumber); // sms:xxxxxxxx format
    },
    emailContact: function() {
        // Display the email dialog
        var emailDialog = Ti.UI.createEmailDialog({
            toRecipients: [this.contact.contact_email]
        });
        emailDialog.open();
    }
});
