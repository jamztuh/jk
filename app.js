var request = require("request");
var cheerio = require("cheerio");
var Q = require("q");


/* News Information */

// Return array of objects with dates and links
var getArticlesWithDatesAndLinks = function(sourceUrl, stock){

	var deferred = Q.defer();

	if (stock && (stock.symbol !== undefined)) {
		sourceUrl = sourceUrl + stock.symbol;
	} else {
		stock = {};
	};

    request(sourceUrl, function(err, res) {
    	var $ = cheerio.load(res.body);
		var articlesWithDatesAndLinks = [];
		var parentTarget;
		var classTarget;
		var baseUrl = sourceUrl.replace(/^((\w+:)?\/\/[^\/]+\/?).*$/,'$1');

		switch(baseUrl) {
		    case 'http://finance.yahoo.com/':
		    	parentTarget = '.nothumb.clearfix .content .txt';
		    	dateTimeTarget = 'cite';
		        linkTarget = 'a';
		        break;
		    case 'http://247wallst.com/':
		    	parentTarget = '.hentry .short_excerpt';
		    	dateTimeTarget = ".post-meta";
		        linkTarget = 'a';
		        break;
		    case 'https://www.thestreet.com/':
		    	parentTarget = '.news-ticker__headline .row .col-sm-9';
		    	dateTimeTarget = "a .news-ticker__headline-trunc time.news-ticker__publish-date";
		        linkTarget = 'a';
		        break;
		    case 'http://stream.wsj.com/':
		    	parentTarget = '.sSubType-article';
		    	dateTimeTarget = "span.stri-time"; // not working
		        linkTarget = 'a.stri-viewSec'
		        break;
		    case 'http://www.finviz.com/':
		    	parentTarget = '.fullview-news-outer tr';
		    	dateTimeTarget = "td[align='right']";
		        linkTarget = '.tab-link-news';
		        break;
		    case 'http://www.businesswire.com/':
		    	parentTarget = 'ul.bwNewsList li';
		    	dateTimeTarget = "div.bwMeta .bwTimestamp time";
		        linkTarget = 'a.bwTitleLink';
		        break;
		    case 'http://www.marketwatch.com/':
		    	parentTarget = 'ol.viewport li';
		    	dateTimeTarget = "span.nv-time";
		        linkTarget = '.nv-text-cont h4 a.read-more';
		        break;
		    case 'http://www.fool.com/':
		    	parentTarget = 'div.list-content div.comment';
		    	dateTimeTarget = "p.author-byline";
		        linkTarget = 'div.comment-content a#recent-article-hl';
		        break;
		};

		var currentDate;

		// Find the parent that contains children of date and url from the source
    	$(parentTarget).each(function (index, element) {

    		var link = $(element).find(linkTarget).attr('href');

    		// Add base url if needed
    		if (link.includes('.com') === false) {
    			link = baseUrl.substring(0, baseUrl.length - 1) + link;
    		};

    		var title = $(element).find(linkTarget).text();

    		var dateTime = $(element).find(dateTimeTarget).text();

    		if (baseUrl === 'http://www.finviz.com/') {
	    		// Add current date if needed
	    		if (dateTime.indexOf(' ') >= 0) {
	    			currentDate = dateTime.split(/\s/)[0];
	    		} else {
	    			dateTime = currentDate + ' ' + dateTime;
	    		};
    		};

    		var article = {};
    		article.link = link.trim();
    		article.thirdSourceTitle = title.trim();
    		article.thirdSourceDate = dateTime.trim();

			articlesWithDatesAndLinks.push(article);

		});

    	stock.articles = articlesWithDatesAndLinks;
		deferred.resolve(stock);
    });
    return deferred.promise;
};

var getStatSentences = function(rawText) {
	var unformattedList = rawText.split(".")
	var formattedList = [];
	for(var i = 0; i < unformattedList.length; i++){
		var isMatch = unformattedList[i].match(/\d+|\%|\$/);	
		if(isMatch != null){
			formattedList.push(unformattedList[i]);
		};	
	};
	return formattedList;
};

var getArticle = function(article) {
	var baseUrl = article.link.replace(/^((\w+:)?\/\/[^\/]+\/?).*$/,'$1');
	var deferred = Q.defer();
    request(article.link, function(err, res) {
    	var $ = cheerio.load(res.body);
		var dateTarget;
		var titleTarget;
		var contentTarget;
		switch(baseUrl) {
		    case 'http://finance.yahoo.com/':
		        dateTarget = '.date';
		        titleTarget = '.canvas-header';
		        contentTarget = '.canvas-body';
		        break;
		    case 'http://247wallst.com/':
		        dateTarget = '.timestamp';
		        titleTarget = '.entry-title';
		        contentTarget = '.entry-content';
		        break;
		    case 'https://www.thestreet.com/':
		        dateTarget = '.article__publish-date.article__byline-item time';
		        titleTarget = '.article__headline';
		        contentTarget = '.article__body';
		        break;
		    case 'http://www.wsj.com/':
		        dateTarget = 'time.timestamp';
		        titleTarget = '.wsj-article-headline';
		        contentTarget = '.wsj-snippet-body';
		        break;
		    case 'http://www.businesswire.com/':
		        dateTarget = '.bw-release-timestamp time';
		        titleTarget = 'h1.epi-fontLg';
		        contentTarget = '.bw-release-story';
		        break;
		    case 'http://www.marketwatch.com/':
		        dateTarget = '#published-timestamp span';
		        titleTarget = '#article-headline';
		        contentTarget = '#article-body';
		        break;
		    case 'http://realmoney.thestreet.com/':
		        dateTarget = '.details .date';
		        titleTarget = '.headline h2';
		        contentTarget = '.article .content';
		        break;
		    case 'http://www.fool.com/':
		        dateTarget = '.publication-date';
		        titleTarget = '.usmf-new.article-header header h1';
		        contentTarget = '.usmf-new.article-body .article-content';
		        break;
		};

		// Upper case, remove .'s, remove &nbps;'s, remove |'s, convert to EDT, and trim trailing white space for date format to work
		article.date = $(dateTarget).text().toUpperCase().replace(/\./g,'').replace(/\u00a0/g, " ").replace(/\|/g,'').replace('ET', 'EDT').replace('EASTERN DAYLIGHT TIME', 'EDT').trim();
		// console.log('Date: ', article.date);
		article.title = $(titleTarget).text();
		// console.log('Title: ', article.title);
		article.rawText = $(contentTarget).text();
		// console.log('Raw Text: ', article.rawText);
		article.statSentences = getStatSentences(article.rawText);
    	// console.log(article.statSentences);

		deferred.resolve(article);
    });
    return deferred.promise;	
};

var getArticles = function(topRecentArticles) {
	var articles = [];
	for(var i = 0; i < topRecentArticles.length; i++){
		var article = getArticle(topRecentArticles[i]);

		articles.push(article);

	};

	return Q.all(articles);
};

var convertEST = function (PST) {
    offset = -4.0

    var clientDate = new Date(PST);
    utc = clientDate.getTime() + (clientDate.getTimezoneOffset() * 60000);

    var serverDate = new Date(utc + (3600000*offset));

    return serverDate;
};

function msToHMS(ms) {
    // 1- Convert to seconds:
    var seconds = ms / 1000;
    // 2- Extract days:
    var days = parseInt( seconds / 86400);
    seconds = seconds % 86400; // seconds remaining after extracting days
    // 3- Extract hours:
    var hours = parseInt( seconds / 3600 ); // 3,600 seconds in 1 hour
    seconds = seconds % 3600; // seconds remaining after extracting hours
    // 4- Extract minutes:
    var minutes = parseInt( seconds / 60 ); // 60 seconds in 1 minute
    // 5- Keep only seconds not extracted to minutes:
    seconds = Math.round(seconds % 60);
    return {
    	days: days,
    	hours: hours,
    	minutes: minutes,
    	seconds: seconds
    };
};

var finVizStats = function(articlesWithDatesAndLinks) {

	var currentDate;
	var currentTime;
	var frequencyMap = {};
	for (var i = 0; i < articlesWithDatesAndLinks.length; i++) {

		var date = articlesWithDatesAndLinks[i].thirdSourceDate.split(' ')[0];
		var time = articlesWithDatesAndLinks[i].thirdSourceDate.split(' ')[1];

		var formatDate = date.split('-');
		formatDate = formatDate[0] + '. ' + formatDate[1] + ', ' + '20' + formatDate[2];
		var formatTime = time.substr(0, time.length-2) + ' ' + time.substr(-2) + ' ' + 'EDT';
	
		var PST = new Date(new Date(formatDate + ' ' + formatTime).getTime() + 1000*60*60*3);

		var today = new Date((new Date()).getTime()  + 1000*60*60*3);
		var timeDiff = today.getTime() - PST.getTime();
		var lastTimeDiff;
		var addTimeDiff;

		if (i === 0) {
			var time = msToHMS(Math.abs(timeDiff));
			frequencyMap.lastPost = time;
			frequencyMap['articles'] = {};
			frequencyMap['articles'][date] = {};
			frequencyMap['articles'][date]['posts'] = 1;
			currentDate = date;
			addTimeDiff = 0;

		} else if (currentDate !== date) {

			frequencyMap['articles'][date] = {};
			frequencyMap['articles'][date]['posts'] = 1;

			currentDate = date;

			addTimeDiff = 0;

		} else {
			frequencyMap['articles'][currentDate]['posts']++;
			addTimeDiff = addTimeDiff + (timeDiff - lastTimeDiff);
			if (frequencyMap['articles'][currentDate]['posts'] > 1) {
				frequencyMap['articles'][currentDate]['avgTimePosts'] = msToHMS(addTimeDiff / (frequencyMap['articles'][currentDate]['posts'] - 1));
			};

		};
		lastTimeDiff = timeDiff;
	}
	return frequencyMap;
};

var printRecentArticles = function(sourceUrl, stock) {
	var baseUrl = sourceUrl.replace(/^((\w+:)?\/\/[^\/]+\/?).*$/,'$1');
	getArticlesWithDatesAndLinks(sourceUrl, stock).then(function(articlesWithDatesAndLinks) {
		// console.log(articlesWithDatesAndLinks);
		getArticles(articlesWithDatesAndLinks.articles).then(function(recentArticles){
			for(var i = 0; i < recentArticles.length; i++){
				console.log('Link: ', recentArticles[i].link);
				console.log('Third Source Date: ', recentArticles[i].thirdSourceDate);
				console.log('Date: ', recentArticles[i].date);
				console.log('Title: ', recentArticles[i].title);
				// console.log('Raw Text: ', recentArticles[i].rawText);
				// console.log('Stat Sentences: ', recentArticles[i].statSentences);
			};
			console.log('Number of Articles Scraped: ', recentArticles.length);
		});
	});
};

// var sourceUrl = "http://finance.yahoo.com/news/provider-ap/?bypass=true";
// var sourceUrl = "http://247wallst.com/";
//var sourceUrl = "https://www.thestreet.com/latest-news";
// var sourceUrl = "http://stream.wsj.com/story/latest-headlines/SS-2-63399/";
// var sourceUrl = "http://www.businesswire.com/portal/site/home/news/";
// var sourceUrl = "http://www.marketwatch.com/newsviewer";
// var sourceUrl = "http://www.fool.com/investing-news/";

// // For non-specific stock source
// printRecentArticles(sourceUrl);

// // For specific stock source
//var sourceUrl = "http://www.finviz.com/quote.ashx?t=";
// printRecentArticles(sourceUrl, {'symbol': 'KSS'});

//get an array of sentences with stats for an article at specified URL
// var articleUrl = "http://finance.yahoo.com/news/nbcs-prime-time-olympics-due-change-221824505--spt.html";
// var articleUrl = "https://www.thestreet.com/story/13674322/1/amazon-remains-intent-on-staying-ahead-of-hungry-cloud-rivals.html";
// var articleUrl = "http://www.wsj.com/articles/where-we-spending-is-unending-traditional-retail-1471041884?ru=yahoo?mod=yahoo_itp";
// var articleUrl = "http://247wallst.com/services/2016/08/12/what-analysts-are-saying-after-alibaba-reported-earnings/"
// var articleUrl = "http://www.marketwatch.com/story/full-house-home-in-san-francisco-on-the-market-for-415-million-2016-06-01?siteid=yhoof2";
// var articleUrl = "http://realmoney.thestreet.com/articles/08/12/2016/july-retail-sales-are-good-sign-amazon";
// getArticle(articleUrl).then(function(statSentencesArray){
// 	console.log(statSentencesArray);
// });





/* Google Finance and Yahoo Finance Ticker Information */

var getTickers = function(url) {
	var deferred = Q.defer();
    request(url, function(err, res) {
		var trendingTickers = [];
    	var $ = cheerio.load(res.body);
		$('.with-ticker-card').filter(function(){
			var trendingTicker = $(this).html();
			trendingTickers.push(trendingTicker);
		});
		deferred.resolve(trendingTickers);
    });
    return deferred.promise;
};

var financeRequest = function(url){
	var deferred = Q.defer();
	request(url, function (error, response, body) {
	  if (!error && response.statusCode == 200) {
		deferred.resolve(body);
	  }
	})
	return deferred.promise;
};

var googleYahooRequests = function(tickersArray) {
	var packGoogleYahooRequests = [];
	var googleFinanceUrl = 'http://finance.google.com/finance/info?client=ig&q=' + tickersArray.join();
	var yahooFinanceUrl = 'https://query.yahooapis.com/v1/public/yql?q=select%20*%20from%20yahoo.finance.quotes%20where%20symbol%20in%20(%27' + tickersArray.join() + '%27)%0A%09%09&format=json&env=http%3A%2F%2Fdatatables.org%2Falltables.env&callback=';
	packGoogleYahooRequests.push(financeRequest(googleFinanceUrl), financeRequest(yahooFinanceUrl));
	return Q.all(packGoogleYahooRequests);
}

var formatStocks = function(googleArray, yahooArray) {
    var googleFinance = JSON.parse(googleArray.substring(3, googleArray.length));
	if (JSON.parse(yahooArray).query.results.quote.length) {
		var yahooFinance = JSON.parse(yahooArray).query.results.quote;
	} else {
		var yahooFinance = [];
		yahooFinance.push(JSON.parse(yahooArray).query.results.quote);
	};
    var stocks = [];
    for(var i = 0; i < yahooFinance.length; i++){
    	var yahooSymbol = yahooFinance[i].Symbol;
    	for(var j = 0; j < googleFinance.length; j++){
    		var googleSymbol = googleFinance[j].t;
    		if(yahooSymbol == googleSymbol){
				var stock = {};
				// Google Finance
				if (googleSymbol) {
					stock.symbol = googleSymbol || Math.random();
				}
				if (googleFinance[j].l) {
					stock.current = parseFloat(googleFinance[j].l);
				}
				if (googleFinance[j].cp) {
					stock.changePrice = parseFloat(googleFinance[j].c);
				}
				if (googleFinance[j].cp) {
					stock.changePercent = parseFloat(googleFinance[j].cp);
				} else {
					stock.changePercent = 0;
				}
				if (googleFinance[j].lt) {
					stock.lastUpdated = googleFinance[j].lt;
				}
				if (googleFinance[j].div) {
					stock.div = parseFloat(googleFinance[j].div);
				}
				// Yahoo Finance
				if (yahooFinance[i].Name) {
					stock.name = yahooFinance[i].Name;
				}
				if (yahooFinance[i].AverageDailyVolume) {
					stock.averageDailyVolume = parseFloat(yahooFinance[i].AverageDailyVolume);						
				}
				if (yahooFinance[i].Open) {
					stock.open = parseFloat(yahooFinance[i].Open);						
				}
				if (yahooFinance[i].PreviousClose) {
					stock.close = parseFloat(yahooFinance[i].PreviousClose);						
				}
				if (yahooFinance[i].DaysRange) {
					stock.dayRange = yahooFinance[i].DaysRange;						
				}
				if (yahooFinance[i].YearRange) {
					stock.yearRange = yahooFinance[i].YearRange;						
				}
				if (yahooFinance[i].FiftydayMovingAverage) {
					stock.fiftyDayMovingAverage = parseFloat(yahooFinance[i].FiftydayMovingAverage);
				}
				if (yahooFinance[i].TwoHundreddayMovingAverage) {
					stock.twoHundredDayMovingAverage = parseFloat(yahooFinance[i].TwoHundreddayMovingAverage);
				}
				if (yahooFinance[i].DividendYield) {
					stock.dividendYield = parseFloat(yahooFinance[i].DividendYield);
				} else {
					stock.dividendYield = 'N/A';
				}
				if (yahooFinance[i].DividendPayDate) {
					stock.dividendPayDate = yahooFinance[i].DividendPayDate;
				} else {
					stock.dividendPayDate = 'N/A';
				}
				stocks.push(stock);
    		}
    	}
    }
	return stocks;
}

var articlesRequest = function(sourceUrl, formattedStocks) {
	var articlesRequest = [];
	for (var i = 0; i < formattedStocks.length; i++) {
		var article = getArticlesWithDatesAndLinks(sourceUrl, formattedStocks[i]);
		articlesRequest.push(article);
	}
	return Q.all(articlesRequest);	
}

var printStocks = function(stockTwitsUrl, sourceUrl, numberOfTopTickers) {
	getTickers(stockTwitsUrl, sourceUrl).then(function(tickersArray) {

		// // Custom Tickers
		// tickersArray = [ 'TWTR' , 'TWLO']

		googleYahooRequests(tickersArray).then(function(googleYahooArray) {

			var formattedStocks = formatStocks(googleYahooArray[0], googleYahooArray[1]);

			// Split if there is a second parameter, otherwise keep all links
			if (numberOfTopTickers && (formattedStocks.length > numberOfTopTickers)) {
				formattedStocks = formattedStocks.splice(0, numberOfTopTickers);
			};

			articlesRequest(sourceUrl, formattedStocks).then(function(stocks) {
				for (var i = 0; i < stocks.length; i++) {
					stocks[i].stats = finVizStats(stocks[i].articles);
				};

				stocks.sort(function(a, b) {

				    // Sort by days
				    var sortDays = parseFloat(a.stats.lastPost.days) - parseFloat(b.stats.lastPost.days);
				    if(sortDays) return sortDays;

				    // If there is a tie, sort by hours
				    var sortHours = parseFloat(a.stats.lastPost.hours) - parseFloat(b.stats.lastPost.hours);
				    if (sortHours) return sortHours;

				    // If there is a tie, sort by minutes
				    var sortMinutes = parseFloat(a.stats.lastPost.minutes) - parseFloat(b.stats.lastPost.minutes);
				    if (sortMinutes) return sortMinutes;

				    // If there is a tie, sort by seconds
				    var sortSeconds = parseFloat(a.stats.lastPost.seconds) - parseFloat(b.stats.lastPost.seconds);
				    return sortSeconds;

				});

				for (var j = 0; j < stocks.length; j++) {
					console.log('___________________ (' + (j + 1) + ') ___________________');
					console.log(stocks[j].symbol + ':',stocks[j].name);
					console.log('Current:', stocks[j].current);	
					console.log('Change Price:', stocks[j].changePrice);
					console.log('Change Percent:', stocks[j].changePercent + '%');
					console.log('Average Daily Volume:', stocks[j].averageDailyVolume);

					if (stocks[j].stats.articles) {
						var lastNewsPost = stocks[j].stats.articles[Object.keys(stocks[j].stats.articles)[0]];

						var days = stocks[j].stats.lastPost.days + ' days';
						if (stocks[j].stats.lastPost.days === 0) {
							var isToday = ((new Date((new Date()).getTime()  + 1000*60*60*3)) - (new Date((new Date()).getTime()  + 1000*60*60*3 - 1000*60*60* stocks[j].stats.lastPost.hours))) === 0;
							if (isToday) {
								days = 'today (EST)'
							} else {
								days = 'yesterday'
							}
						};

						console.log('Last post was', days + ',', stocks[j].stats.lastPost.hours, 'hours,', stocks[j].stats.lastPost.minutes, 'minutes,', 'and', stocks[j].stats.lastPost.seconds, 'seconds ago:', lastNewsPost.posts);
						console.log("Post count for that day:", lastNewsPost.posts);

						if (lastNewsPost.avgTimePosts) {
							console.log("Average Time Between Posts:", lastNewsPost.avgTimePosts);
						};

						if ((lastNewsPost.posts <= 1)) {
							console.log('Spotlight:', 'People');
						} else if ((lastNewsPost.avgTimePosts.hours <= 1) && ((stocks[j].stats.lastPost.days === 0) && (lastNewsPost.posts > 1))) {
							console.log('Spotlight:', 'News');
						} else {
							console.log('Spotlight:', 'People');
						};

						var lastArticles = 3;
						for (var k = 0; k < ((stocks[j].articles.length) - (stocks[j].articles.length - lastArticles)); k++) {
							console.log(stocks[j].articles[k].thirdSourceDate + ':', stocks[j].articles[k].thirdSourceTitle);
						};

					};

					console.log('Google:', 'https://www.google.com/#q=' + stocks[j].symbol + '+stock');
					console.log('FinViz:', sourceUrl + stocks[j].symbol);

				}
			});
		});
	});
}

var stockTwitsUrl = "http://stocktwits.com/";
var sourceUrl = "http://www.finviz.com/quote.ashx?t=";
printStocks(stockTwitsUrl, sourceUrl);

