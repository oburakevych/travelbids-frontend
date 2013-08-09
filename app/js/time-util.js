var TimeUtil = {
	countdownThreashould: 60000
};

TimeUtil.MILLIS_IN_SECOND = 1000;
TimeUtil.ZERO_DATE = new Date(0); //01.01.1970 00:00:00
TimeUtil.ZERO_DATE_DAYS = TimeUtil.ZERO_DATE.getDate();
TimeUtil.ZERO_DATE.HOURS = TimeUtil.ZERO_DATE.getHours();
TimeUtil.ZERO_DATE.MINUTES = TimeUtil.ZERO_DATE.getMinutes();

TimeUtil.TIME_FORMAT_SEPARATOR  = ":";
TimeUtil.SECONDS_APPENDING_TEXT = " seconds";

TimeUtil.millisToSeconds = function(millis) {
	return Math.round(millis/TimeUtil.MILLIS_IN_SECOND);
}

TimeUtil.millisToReadableText = function(millis) {
	if (millis > TimeUtil.countdownThreashould) {
		return TimeUtil.millisToReadableCountDownText(millis);
	} else {
		return TimeUtil.millisToFinalCountDownText(millis);
	}
}

TimeUtil.millisToFinalCountDownText = function(millis) {
	var readableText = null;
	
	var seconds = TimeUtil.millisToSeconds(millis);
	if (seconds <= 0) {
		switch(seconds) {
			case 0:
				readableText = "COUNTING ONCE";
				break;
			case -1:
				readableText = "COUNTING TWICE";
				break;
			case -2:
				readableText = "FINAL CALL";
				break;
			case -3:
				readableText = "FINISHED";
				break;
			case -4:
				readableText = "FINISHED";
				break;
			default: 
				readableText = seconds + TimeUtil.SECONDS_APPENDING_TEXT;
		}
	} else {
		readableText = seconds + TimeUtil.SECONDS_APPENDING_TEXT;
	}

	return readableText;
}

TimeUtil.millisToReadableCountDownText = function(millis) {
	var date = new Date(millis);

	var countDownTime = {
		days: date.getDate() - TimeUtil.ZERO_DATE_DAYS,
		hours: date.getHours() - TimeUtil.ZERO_DATE.HOURS,
		minutes: date.getMinutes() - TimeUtil.ZERO_DATE.MINUTES,
		seconds: date.getSeconds()
	}

	if (countDownTime.hours < 10) {
		countDownTime.hours = "0" + countDownTime.hours;
	}

	if (countDownTime.minutes < 10) {
		countDownTime.minutes = "0" + countDownTime.minutes;
	}

	if (countDownTime.seconds < 10) {
		countDownTime.seconds = "0" + countDownTime.seconds;
	}

	return countDownTime.hours + TimeUtil.TIME_FORMAT_SEPARATOR 
				+ countDownTime.minutes + TimeUtil.TIME_FORMAT_SEPARATOR
				+ countDownTime.seconds;

}