/**
We should gather info on <VIDEO> element usage, including:

 * does given page have HTML5 video elements?
 * if yes, what are their classes / IDs (interesting for identifying video libs)
 * list of video formats given for element
 * element.currentSrc (an indication of whether a valid source was found)
 * readyState (ditto)
 * video embedding script name if recognisable
   * It would be nice to detect video.js, jplayer, popcorn.js,
   * YouTube API scripts (old player, new iframe), brightcove (old, new)
*/

var VideoStats = function (page, manager) {
  'use strict';
  this.name = "video-stats";
  this.res = {hasVideo:false, types:[], classNames:[], httpTypes: [],
    readyStates:[], IDs:[], libraries:[], currentSrc:''};
  this._page = page;
  this.manager = manager;
};


VideoStats.prototype.onResourceReceived = function (responseData) {
  if(responseData.contentType || responseData.mimeType) {
    var type = (responseData.contentType || responseData.mimeType).toLowerCase();
    // Detect loading requests of type video/*
    // and Apple's vnd.mpeg-url stuff.
    if(type.indexOf('video/') > -1 || type.indexOf('mpeg') > -1) {
      if(this.res.httpTypes.indexOf(type) === -1){
        this.res.httpTypes.push(type);
      }
    }
  }

  // Some domain and script names associated with new and old Brighcove players
  if(responseData.url && responseData.url.indexOf('players.brightcove.net') > -1) {
    this.res.libraries.push('brightcove-new');
  }

  if(responseData.url && /(admin|c)\.brightcove\.com/.test(responseData.url)) {
    this.res.libraries.push('brightcove-old');
  }

  if(responseData.url && /BrightcoveExperiences/i.test(responseData.url)) {
    this.res.libraries.push('brightcove-old');
  }

  if(responseData.url && /flowplayer/i.test(responseData.url)) {
    this.res.libraries.push('flowplayer');
  }
};

VideoStats.prototype.onLoadFinished = function () {
  this.manager.pluginAsync(this.name); // We're not done until we're done..
  // First check for <video>
  var self = this;
  this._page.evaluate(function(){
    var videoResults = {types:[], classNames:[], httpTypes: [],
    readyStates:[], IDs:[], libraries:[], currentSrc:[]};
    videoResults.hasVideo = document.getElementsByTagName('video').length > 0;

    // TODO: detect some SWF video players..

    var libTests = {
      'video.js': function(){return typeof window.videojs !== 'undefined';},
      'jPlayer': function(){
        return (window.jQuery && typeof window.jQuery.jPlayer !== 'undefined') ||
            window.$ && typeof $(document).jPlayer !== 'undefined';
      },
      'flowplayer': function(){return typeof window.flowplayer !== 'undefined';},
      'Popcorn': function(){return typeof window.Popcorn !== 'undefined';},
      'Kaltura': function(){return typeof window.kalturaIframeEmbed !== 'undefined';},
      'YouTube': function(){return typeof window.onYouTubePlayerReady !== 'undefined';},
      'YouTubeOld': function(){return typeof window.onYouTubePlayerReady !== 'undefined' && typeof window.ytplayer !== 'undefined';},
      'YouTubeNew': function(){return typeof window.onYouTubePlayerReady !== 'undefined' && window.YT && typeof window.YT.Player !== 'undefined';}
    };
    for(var libTest in libTests) {
      if(libTests[libTest]()) {
        videoResults.libraries.push(libTest);
      }
    }
    [].forEach.call(document.querySelectorAll('video'), function(elm){
      videoResults.classNames = videoResults.classNames.concat(elm.className.split(' '));
      videoResults.IDs.push(elm.id);
      videoResults.currentSrc.push(elm.currentSrc);
      videoResults.readyStates.push(elm.readyState);
    });
    // List all MIME types mentioned
    [].forEach.call(document.querySelectorAll('video,source'), function(elm){
      if(elm.type){
        videoResults.types.push(elm.type);
      }
    });
    return JSON.stringify(videoResults);
  }).then(function(videoStatsResults){
    // Note: this event might fire several times - for this page and sub-frames
    // hasVideo should track the "combined" state - be true if
    // *any* subframe contains <video> elements
    videoStatsResults = videoStatsResults[0];
    self.res.hasVideo = self.res.hasVideo || videoStatsResults.hasVideo;
    // Check various attributes
 
    // Add to results
    self.res.IDs = self.res.IDs.concat(videoStatsResults.IDs);
    self.res.classNames = self.res.classNames.concat(videoStatsResults.classNames);
    self.res.currentSrc = self.res.currentSrc.concat(videoStatsResults.currentSrc);
    self.res.readyStates = self.res.readyStates.concat(videoStatsResults.readyStates);
    self.res.libraries = self.res.libraries.concat(videoStatsResults.libraries);
    self.res.types = self.res.types.concat(videoStatsResults.types);
    self.manager.pluginDone(self.name);
  });

};

VideoStats.prototype.getResult = function () {
  return this.res;
};

try {
  if (exports) {
    exports.Plugin = VideoStats;
  }
} catch (ex) {
  VideoStats = module.exports;
}
