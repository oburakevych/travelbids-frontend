'use strict';

/* Filters */

var filtersModule = angular.module('myApp.filters', []);

filtersModule.constants = {};

filtersModule.constants.ZERO_DATE = new Date(0); //01.01.1970 00:00:00
filtersModule.constants.ZERO_DATE_DAYS = filtersModule.constants.ZERO_DATE.getDate();
filtersModule.constants.ZERO_DATE.HOURS = filtersModule.constants.ZERO_DATE.getHours();
filtersModule.constants.ZERO_DATE.MINUTES = filtersModule.constants.ZERO_DATE.getMinutes();

filtersModule.constants.TIME_FORMAT_SEPARATOR = ":";


filtersModule.filter('interpolate', ['version', function(version) {
    return function(text) {
      return String(text).replace(/\%VERSION\%/mg, version);
    }
  }]);
  
filtersModule.filter('timeleft', [function() {
    return function(millisLeft) {
			var leftDate = new Date(millisLeft);

			var timeLeft = {
				days: leftDate.getDate() - filtersModule.constants.ZERO_DATE_DAYS,
				hours: leftDate.getHours() - filtersModule.constants.ZERO_DATE.HOURS,
				minutes: leftDate.getMinutes() - filtersModule.constants.ZERO_DATE.MINUTES,
				seconds: leftDate.getSeconds()
			}

			if (timeLeft.hours < 10) {
				timeLeft.hours = "0" + timeLeft.hours;
			}

			if (timeLeft.minutes < 10) {
				timeLeft.minutes = "0" + timeLeft.minutes;
			}

			if (timeLeft.seconds < 10) {
				timeLeft.seconds = "0" + timeLeft.seconds;
			}

			var formattedTime = timeLeft.hours + filtersModule.constants.TIME_FORMAT_SEPARATOR 
								+ timeLeft.minutes + filtersModule.constants.TIME_FORMAT_SEPARATOR
								+ timeLeft.seconds;

			return formattedTime;
    }
}]);
