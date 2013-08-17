'use strict';

/* Filters */

var filtersModule = angular.module('tbApp.filters', []);
  
filtersModule.filter('readableTime', [function() {
    return function(millisLeft) {
    	if (!millisLeft) {
    		return "";
    	}

    	return TimeUtil.millisToReadableText(millisLeft);
    }
}]);