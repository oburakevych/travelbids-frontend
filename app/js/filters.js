'use strict';

/* Filters */

var filtersModule = angular.module('tbApp.filters', []);
  
filtersModule.filter('readableTime', [function() {
    return function(millisLeft) {
    	return TimeUtil.millisToReadableText(millisLeft);
    }
}]);