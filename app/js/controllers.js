'use strict';

/* Controllers */

var controllersModule = angular.module('tbApp.controllers', []);
  
controllersModule.controller('AuctionsDiscoverController', ['$rootScope', '$scope', 'angularFire', '$timeout', '$filter', 'firebaseReference',
	function($rootScope, $scope, angularFire, $timeout, $filter, firebaseReference) {
		$scope.auctionsDiscoveryPromise = angularFire(firebaseReference.getInstance() + "/auctionlist", $scope, 'auctionlist', []);

		$scope.auctionsDiscoveryPromise.then(function() {
			console.log("AuctionsDiscoverController auctionsDiscoveryPromise resolved");
			$timeout(function() {
				$scope.$broadcast("AUCTION_INIT");
			}, 500);
			
		}, function() {
			console.error("AuctionsDiscoverController auctionsDiscoveryPromise rejected");
		});
	}
]);

controllersModule.controller('AuctionController', ['$rootScope' ,'$scope', 'angularFire', '$timeout', '$filter', 'firebaseReference', 'COUNT_DOWN_INTERVAL', 'AUCTION_VERIFY_CONDITION', 'AUCTION_FINISHED_CONDITION',
	function($rootScope, $scope, angularFire, $timeout, $filter, firebaseReference, COUNT_DOWN_INTERVAL, AUCTION_VERIFY_CONDITION, AUCTION_FINISHED_CONDITION) {
		$scope.$on("AUCTION_INIT", function() {
			$scope.init();
		});

		$scope.$on("AUCTION_FINISHED", function(event, auctionId) {
			console.warn("AUCTION_FINISHED");
			if ($scope.auction.id === auctionId) {
				console.log("Auction " + auctionId + " FINISHED!");
				console.log(angular.toJson($scope.auction));
				
				$timeout(function() {
					$scope.resetSeconds = 20;
					$scope.auctionVerify = false;
					
					var winnerPromise = angularFire(firebaseReference.getInstance() + "/user/" + $scope.auction.winnerUserId + "/name", $scope, 'winner', "");
					winnerPromise.then(function(disassociate) {
						$scope.winnerDisassociateFn = disassociate;
					});

					if ($scope.auctionIntervalTimerId) {
						clearInterval($scope.auctionIntervalTimerId);
					}
				}, 0, true);
			}
		});

		$scope.$on('AUCTION_RESET', function(event, auctionId) {
			console.warn('AUCTION_RESET');

			if ($scope.auction && $scope.auction.id === auctionId) {
				$scope.auctionFinished = false;

				$scope.auctionRef.off();

				$scope.unregisterAuctionStatusWatch();
				$scope.auctionDisassociateFn();
				$scope.auction = null;
				
				$scope.winnerDisassociateFn();
				$scope.winner = null;
				
				$scope.biddingHistoryRef.remove(function() {
					$scope.biddingHistoryRef.off();
					$scope.biddingHistoryQuery.off();
				});

				$scope.offsetRef.off();
				
				$timeout($scope.init, 1000, true);
			}
		});

		$scope.init = function() {
			console.log("AUCTION_INIT");

			$scope.auctionRef = firebaseReference.getInstance().child("/auction/" + $scope.auctionId);
			angularFire($scope.auctionRef, $scope, 'auction', {})
				.then(function(disassociate) {
					$scope.auctionDisassociateFn = disassociate;
					
					$scope.biddingHistoryRef = firebaseReference.getInstance().child('bidding-history/auction/' + $scope.auction.id);
					$scope.biddingHistory = FixedQueue(1);
					$scope.pendingBiddingHistoryEntry = {};
					$scope.biddingHistoryQuery = $scope.biddingHistoryRef.limit(10);
					$scope.biddingHistoryQuery.on("child_added", function(bidderSnapshot) {
						$scope.biddingHistory.unshift(bidderSnapshot.val());
					});

					$scope.offsetRef = firebaseReference.getInstance().child("/.info/serverTimeOffset");
					$scope.offsetRef.on("value", function(snap) {
						$scope.serverOffsetMillis = snap.val();
						console.log("Offset: " + $scope.serverOffsetMillis);
					});

					$scope.unregisterAuctionStatusWatch = $scope.$watch(function() {
						return $scope.auction.status;
					}, function(newStatus, oldStatus) {
						console.log("oldStatus: " + oldStatus + "; newStatus: " + newStatus);
						if (newStatus === 'FINISHED') {
							$scope.auctionVerify = false;
							$scope.auctionFinished = true;
							$scope.$broadcast("AUCTION_FINISHED", $scope.auction.id);
						} else if (oldStatus === 'FINISHED' && newStatus === 'COUNTDOWN') {
							$scope.$broadcast("AUCTION_RESET", $scope.auction.id);	
						} else if(newStatus !== "FINISHED") {
							$timeout($scope.startCountdown, 200);
						}
					}, true);
				});
		}
		
		$scope.calculateTimeLeft = function() {
			return $scope.auction.endDate - Date.now() - $scope.serverOffsetMillis;;
		}

		$scope.displayCount = function(millisLeft) {
			if (millisLeft < COUNT_DOWN_INTERVAL) {
				var displayClass = null;
				switch(TimeUtil.millisToSeconds(millisLeft)) {
					case 0:
						displayClass = "count once";
						break;
					case -1:
						displayClass = "count twice";
						break;
					case -2:
						displayClass = "count final";
						break;
					case -3:
						displayClass = "count verify";
						break;
					case -4:
						displayClass = "count verify";
						break;
					case -5:
						displayClass = "count verify";
						break;
					default:
						displayClass = "count";
				}

				return displayClass;
			}

			return "";
		}

		$scope.getBidBtnState = function() {
			if ($scope.auctionVerify || $scope.auctionFinished) {
				return "btn-disabled";
			} 

			return "btn-primary";
		}

		$scope.startCountdown = function() {
			$scope.timeLeft = $scope.calculateTimeLeft();

			$scope.auctionIntervalTimerId = setInterval(function() {
				$scope.$apply(function() {
					//var start = Date.now();
					if ($scope.auction.status === 'FINISHED') {
						$scope.auctionVerify = false;
						$scope.auctionFinished = true;
						return;
					}

					$scope.timeLeft = $scope.calculateTimeLeft();
					
					if ($scope.timeLeft <= $scope.auction.COUNT_DOWN_TIME) {
						if ($scope.timeLeft <= (AUCTION_VERIFY_CONDITION + 1000) && $scope.timeLeft > AUCTION_FINISHED_CONDITION) {
							if (TimeUtil.millisToSeconds($scope.timeLeft) <= TimeUtil.millisToSeconds(AUCTION_VERIFY_CONDITION)) {
								$scope.auctionVerify = true;
							}
						} else if ($scope.timeLeft <= AUCTION_FINISHED_CONDITION) {
							if (TimeUtil.millisToSeconds($scope.timeLeft) <= TimeUtil.millisToSeconds(AUCTION_FINISHED_CONDITION)) {
								$scope.finishAuction();
							}
						} else if ($scope.auction.status !== 'COUNTDOWN') {
							$scope.auction.status = 'COUNTDOWN';
						}
					}

					//console.log("Time to calculate: " + (Date.now() - start));
				});
				
			}, COUNT_DOWN_INTERVAL);
		}

		$scope.bid = function() {
			if(!$scope.isBidAuthorized()) {
				return;
			}

			$scope.auctionRef.transaction(function(auction) {
				var auctionEndDate = $scope.getNewEndDate();

				if (auctionEndDate) {
					auction.endDate = auctionEndDate;
				}

				auction.price = Math.round((auction.price + 0.01) * 100)/100;

				$rootScope.authUser.balance -= 1.0;
				$scope.biddingHistoryEntry = $scope.biddingHistoryRef.push({'username': $rootScope.authUser.name, 'userId': $rootScope.authUser.id, 'date': Firebase.ServerValue.TIMESTAMP});

				return auction;
			}, function(error, committed, snapshot) {
				if (error) {
					console.error("Error increasing auction price: " + error);
					$rootScope.authUser.balance += 1.0; // Roll back account balance
					$scope.biddingHistoryEntry.remove();
				}

				if (committed) {
					
				}
			});
		}

		$scope.isBidAuthorized = function() {
			if ($scope.auctionVerify) {
				console.warn("Auction winner is being verified, bidding disabled!");
				return false;
			}

			if ($scope.auctionFinished) {
				console.warn("Auction already fishished!");
				return false;
			}

			if (!$scope.auction) {
				console.error("Auction not initialized!");
				return false;
			}

			if ($scope.isZeroOrNegativeBallance()) {
				console.error("No sufficient funds to bid! Account balance: " + $rootScope.authUser.balance);
				return false;
			}

			return true;
		}

		$scope.getNewEndDate = function() {
			var millis = Date.now() + $scope.auction.COUNT_DOWN_TIME + $scope.serverOffsetMillis + 20;

			if(millis < $scope.auction.endDate) {
				return $scope.auction.endDate;
			}

			return millis;
		}

		$scope.finishAuction = function() {
			$scope.auctionVerify = false;
			$scope.auctionFinished = true;

			$scope.auctionRef.transaction(function(auction) {
				auction.status = "FINISHED";

				if ($scope.biddingHistory.length > 0) {
					auction.winnerUserId = $scope.biddingHistory[0].userId;
				} else {
					console.warn("Auction finished with no winner");
					auction.winnerUserId = "nowinner";
				}

				return auction;
			}, function(error, committed, snapshot) {
				if (error) {
					console.error("Error finishing the auction!");
					auction.status = "ERROR";
				}
			});
		}

		$scope.resetTimer = function() {
			$scope.auctionRef.transaction(function(auction) {
					console.log("About to Set COUNTDOWN in transaction");
					auction.status = "COUNTDOWN";
					console.log("Set COUNTDOWN in transaction");
					auction.endDate = Date.now() + $scope.serverOffsetMillis + $scope.resetSeconds * 1000 + 1220;
					auction.winnerUserId = null;
					auction.price = 1.00;

					return auction;
			});
		}

		$scope.isUserLoggedIn = function() {
			return $rootScope.authUser && $rootScope.authUser.isLoggedIn;
		}

		$scope.isAdminLoggedIn = function() {
			return $scope.isUserLoggedIn();// && $rootScope.authUser.id == 'facebook-1334464456';
		}

		$scope.isZeroOrNegativeBallance = function() {
			return $rootScope.authUser && $rootScope.authUser.balance <= 0;
		}
	}
]);

controllersModule.controller('SignupController', ['$rootScope' ,'$scope', 'angularFire', 'angularFireAuth','$timeout', '$filter', 'firebaseReference',
	function($rootScope, $scope, angularFire, angularFireAuth, $timeout, $filter, firebaseReference) {
	}
]);


controllersModule.controller('LoginController', ['$rootScope' ,'$scope', 'angularFire', 'angularFireAuth','$timeout', '$filter', 'firebaseReference',
	function($rootScope, $scope, angularFire, angularFireAuth, $timeout, $filter, firebaseReference) {
		$scope.auth = new FirebaseSimpleLogin(firebaseReference.getInstance(), function(error, user) {
			if (error) {
				console.error("Error logging in: " + error);
			} else if(user) {
			    console.log(user.first_name + " " + user.last_name);

			    var userChildLocation = user.provider + "-" + user.id;
				$scope.userPromise = angularFire(firebaseReference.getInstance() + "/user/" + userChildLocation, $rootScope, 'authUser', {});

				$scope.userPromise.then(function(disassociate) {
					if (!$rootScope.authUser || !$rootScope.authUser.id) {
						var tbUser = {
							id: userChildLocation,
							name: user.name,
							created: Firebase.ServerValue.TIMESTAMP,
							provider: user.provider,
							balance: 100.00,
							isLoggedIn: true							
						}

						if (user.email) {
							tbUser.email = user.email;
						} else if (user.emails) {
							tbUser.email = user.emails[0];
						}

						if (user.gender) {
							tbUser.gender = user.gender;
						}

				    	$scope.registerUser(tbUser, function() {
								console.log("User " + $rootScope.authUser.name + " has been registered successfully!");
								$rootScope.$broadcast('USER_LOGGS_IN');
							}
						);
					} else {
						$rootScope.authUser.isLoggedIn = true;
						$rootScope.$broadcast('USER_LOGGS_IN');
					}

					$scope.logout = function() {
						console.log("Logging out user " + $rootScope.authUser.name);
						$scope.auth.logout();
						$rootScope.authUser.isLoggedIn = false;

						$rootScope.$broadcast("USER_LOGGS_OUT", $rootScope.authUser.id);

						disassociate();
						$rootScope.authUser = null;
					}
				});
		  	}
		});

		$scope.login = function(serviceProvider, permissions) {
			$scope.auth.login(serviceProvider, {
  				rememberMe: true,
  				scope: permissions
			});
		}

		$scope.registerUser = function(user, callback) {
			if (user) {
				firebaseReference.getInstance().child("user/" + user.id).set(user, callback);
			}
		}
	}
]);