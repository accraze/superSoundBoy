/**
 * Load an audio sample from a URL
 * @param {String}                                  url                     The audio asset url
 * @param {function(audioData:Array)}               [loadedCallbackFn]      A callback function triggered when the audio is successfully loaded
 * @param {*}                                       [callbackContext]       The callback function context
 */
function loadAudioFromUrl( url, loadedCallbackFn, callbackContext ) {
    var request = new XMLHttpRequest();
    request.open("GET", url, true);
    request.responseType = "arraybuffer";

    request.onload = function() {
        consoleout( "Loaded audio '" + url + "'" );

        later( 0,
               loadedCallbackFn,
               callbackContext,
               request.response );
    };

    request.onerror = function() {
        consoleout(
            "ERROR: Failed to load audio from " + url );
    };

    request.send();
}

/**
 * The audio layer class
 *
 * @param {AudioContext}  audioContext  The bus' parent audio context
 *
 * @constructor
 */
function AudioLayer( audioContext ) {
    this.audioContext = audioContext;

    // Create the volume GainNode
    this.volNode = audioContext.createGain();

    // Expose the gain control
    this.gain = this.volNode.gain;

    // Calculate the frequency metrics
    var EQ_FREQ_MARGIN = 1000;  // margin for equalizer range
    var NODES_NUM = 5;          // number of equalizer nodes

    var tempFilter = audioContext.createBiquadFilter();
    var freqMin = 10 + EQ_FREQ_MARGIN;
    var freqMax = Math.round(this.audioContext.sampleRate * 0.5 ) - EQ_FREQ_MARGIN;
    var freqStep = (freqMax - freqMin) / (NODES_NUM - 1);

    console.log(tempFilter);
    console.log( 'freq min=' + freqMin);
     console.log( 'freq max=' + freqMax);

    // Create the equalizer nodes to cover the
    // frequency spectrum evenly
    var headNode = audioContext.destination;
    this.eqNodes = [];
    this.eqParms = [];
    for( var nodeIndex = 0;
         nodeIndex < NODES_NUM;
         nodeIndex++ ) {
        // Set up the filter
        var eqNode = audioContext.createBiquadFilter();

        eqNode.frequency.value =
                Math.round( freqMin + (nodeIndex * freqStep) );
        console.log( Math.round( freqMin + (nodeIndex * freqStep) ));
        if( nodeIndex == 0 ) {
            // Use a low shelf filter for the lowest filter
            eqNode.type = "lowshelf";
        } else if( nodeIndex == NODES_NUM - 1 ) {
            // Use a high shelf filter for the lowest filter
            eqNode.type = "highshelf";
        } else {
            eqNode.type = "peaking";
        }

        // Connect to the previous node
        eqNode.connect( headNode );

        // Keep track of the node
        this.eqNodes.push( eqNode );

        // Add the tweakable audio parameters to the
        // equalizer parameter array
        this.eqParms.push({
            frequency:  eqNode.frequency,
            Q:          eqNode.Q,
            gain:       eqNode.gain
        } );



        // Keep track of the head node
        headNode = eqNode;
    }

    // Connect the volume control to the last head node
    this.volNode.connect( headNode );
}

/**
 * Returns the equalizer frequency response
 *
 * @param {Float32Array}  freqs   List of frequencies to sample
 *
 * @returns {Float32Array}   The equalizer frequency response in dB
 */
AudioLayer.prototype.getEqResponse = function( freqs ) {
    var magCombined = new Float32Array( freqs.length );

    // Get the frequency response from all the eq nodes
    var eqNodes = this.eqNodes;
    var magCurr = new Float32Array( freqs.length );
    var phaseCurr = new Float32Array( freqs.length );
    for( var eqIndex = 0; eqIndex < eqNodes.length; eqIndex++ ) {
        eqNodes[ eqIndex ].getFrequencyResponse(
                freqs,
                magCurr,
                phaseCurr );

        // Combine the node magnitudes
        for( var freqIndex = 0; freqIndex < freqs.length; freqIndex++ ) {
            var magDb = Math.log(magCurr[ freqIndex ]) * 20;
            magCombined[ freqIndex ] += magDb;
        }
    }

    return magCombined;
};

/**
 * Play an audio buffer sound
 *
 * @param {AudioBuffer} audioSrc    The source audio buffer
 * @param {Number}      startSecs   The scheduled start time
 * @param {Boolean}     [loop]      true to enable looping
 *
 * @returns {AudioBufferSourceNode}
 */
AudioLayer.prototype.playAudioBuffer = function( audioSrc,
                                                 startSecs,
                                                 loop ) {
    // Create the audio source node
    var sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = audioSrc;

    // Add backwards compatibility
    if( sourceNode.stop == null )
        sourceNode.stop = sourceNode.noteOff;
    if( sourceNode.start == null )
        sourceNode.start = sourceNode.noteOn;

    // Turn on looping if necessary
    if( loop )
        sourceNode.loop = true;

    // Connect the node to the volume control
    sourceNode.connect( this.volNode );

    // Start playback
    sourceNode.start( startSecs );
    return sourceNode;
};

/**
 * Web Audio application
 * @constructor
 */
function WebAudioApp() {}

/**
 * Initialize WebAudio
 * @private
 *
 * @return {Boolean}    Returns true if successful.
 */
WebAudioApp.prototype.initWebAudio = function() {
    var audioContextClass = window.webkitAudioContext
                            || window.AudioContext;

    if( audioContextClass == null )
        return false;

    this.audioContext = new audioContextClass();

    // Add backward compatibility
    if( this.audioContext.createGain == null )
        this.audioContext.createGain = this.audioContext.createGainNode;

    return true;
};

/**
 * Loads audio into an AudioBuffer
 * @private
 *
 * @param {String}                          audioSrc
 * @param {function(buffer:AudioBuffer)}    callbackFn
 * @param {*}                               [context]
 */
WebAudioApp.prototype.loadAudio = function( audioSrc, callbackFn, context ) {
    loadAudioFromUrl( audioSrc, function(audioData){
        // Decode the audio data into an audio buffer
        this.audioContext.decodeAudioData(
            audioData,
            function( audioBuffer ) {
                consoleout( "Decoded audio for '"
                        + audioSrc + "'" );

                callbackFn.call( context || this, audioBuffer );
            }
        );
    }, this );
};

/**
 * Application entry point
 */
WebAudioApp.prototype.start = function() {
    if( !this.initWebAudio() ) {
        consoleout( "Browser does not support WebAudio" );
        return;
    }

    // Initialize the music tracker attributes
    this.musicLayer = new AudioLayer( this.audioContext );
    this.musicGroups = {};
    this.musicStartSecs = -1;
    this.activeMusicGroupCount = 0;

    // Initialize beats as one group
    this.initMusic(
        "#beat1",
        "beats",
        "assets/dnb160.wav" );
    this.initMusic(
        "#beat2",
        "beats",
        "assets/looperman-l-0082073-0016550-mrrobot-mrrobot-dnbazzz-g-02-160.wav" );
    this.initMusic(
        "#beat3",
        "beats",
        "assets/looperman-l-1048767-0076807-buffalonugaluss-dnb-breaks.wav");
    this.initMusic(
        "#beat4",
        "beats",
        "assets/looperman-l-0063133-0011583-rogueai-amen-break-sliced-160.wav");

    // Initialize the instruments as one group
    this.initMusic(
        "#guitar",
        "instruments",
        "assets/looperman-l-1295091-0077015-gdenza-12-bar-a-blues.wav" );
    this.initMusic(
        "#piano",
        "instruments",
        "assets/looperman-l-0450777-0077228-boysurgeon-piano.wav" );
    this.initMusic(
        "#bass",
        "instruments",
        "assets/looperman-l-0379853-0063872-alen9r-ops-cats-banger-bass.wav" );
    this.initMusic(
        "#orchestra",
        "instruments",
        "assets/looperman-l-0139050-0047375-dusthill-who-dat-orchestral.wav" );

    // Initialize the synths as individual groups
    this.initMusic(
        "#woozySynth",
        "synths",
        "assets/looperman-l-1033898-0077790-gabriel766-you-wont-remember.wav" );
    this.initMusic(
        "#raveSynth",
        "synths",
        "assets/looperman-l-1177594-0075459-robosocks-rave-synth.wav" );
    this.initMusic(
        "#shredSynth",
        "synths",
        "assets/looperman-l-0671112-0067273-danke-shred.wav" );
    this.initMusic(
        "#electro",
        "synths",
        "assets/looperman-l-0148594-0015226-ecksjoe-dnb-techno-groove-loop.wav" );

    //initialize the sfx
    this.initMusic(
        "#drop1",
        "drop1",
        "assets/looperman-l-0562523-0047663-digitalskyy-bombs-away-mayday-malone.wav" );
    this.initMusic(
        "#applause",
        "applause",
        "assets/applause.mp3" );
    this.initMusic(
        "#airhorn",
        "airhorn",
        "assets/airHorn.mp3" ); 
    this.initMusic(
        "#wub",
        "wub",
        "assets/looperman-l-0691016-0058556-lfbofficial-heavy-bass-shot-160-bpm.wav" );

    //initialize the banter
    this.initMusic(
        "#jesus",
        "jesus",
        "assets/jesusChrist.mp3" );
    this.initMusic(
        "#dread",
        "dread",
        "assets/dreadControl.mp3" );
    this.initMusic(
        "#tellDj",
        "tellDj",
        "assets/tellDJ.mp3" );
    this.initMusic(
        "#sizzla",
        "sizzla",
        "assets/sizzla.mp3" );

    // Initialize the volume slider
    this.initSlider(
            "#musicvol",
            this.musicLayer.gain,
            0.01,
            "music volume" );

    // Initialize the equalizer sliders
    var eqParms = this.musicLayer.eqParms;
    for( var nodeIndex = 0; nodeIndex < eqParms.length; nodeIndex++ ) {
        var parms = eqParms[ nodeIndex ];
        var freqValue = String( parms.frequency.value );
        this.initSlider(
            "#eq_gain_" + nodeIndex,
            parms.gain,
            0.01,
            "Gain " + freqValue + " Hz",
            {
                orientation: "vertical"
            } );
        this.initSlider(
            "#eq_q_" + nodeIndex,
            parms.Q,
            0.01,
            "Q " + freqValue + " Hz",
            {
                orientation: "vertical",
                min: 0.25,
                max: 2.5
            } );

        // Set up the label
        $("#eq_label_" + nodeIndex).text( freqValue + " Hz" );
    }

    // Set up equalizer graphics update on slider change
    var me = this;
    $( "[id^=eq_]" ).on( "slide", function() {
        me.updateEqGraphic();
    } );

    // Refresh the equalizer graphics
    this.updateEqGraphic();
};

/**
 * Update the equalizer graphics
 * @private
 */
WebAudioApp.prototype.updateEqGraphic = function() {
    var FREQ_MIN  = 10;             // Hz
    var FREQ_MAX  = Math.round(
            this.audioContext.sampleRate * 0.5 );

    var MAG_MIN = -80;
    var MAG_MAX = 80;

    // Build the frequency response sampler list
    if( this.eqFreqs == null ) {
        var FREQS_NUM = 100;
        var FREQ_STEP = (FREQ_MAX - FREQ_MIN) / (FREQS_NUM - 1);

        this.eqFreqs = new Float32Array( FREQS_NUM );
        for( var freqIndex = 0; freqIndex < FREQS_NUM; freqIndex++ )
            this.eqFreqs[freqIndex] =
                Math.round( FREQ_MIN + (freqIndex * FREQ_STEP) );
    }

    // If we have an update scheduled, don't do anything
    if( this.eqUpdateHandle != null )
        return;

    // Schedule the graphic update
    this.eqUpdateHandle = later( 0, function(){
        this.eqUpdateHandle = null;

        var canvasCtx       = $( "#eqcanvas" )[0].getContext( "2d" );
        var canvasWidth     = canvasCtx.canvas.width;
        var canvasHeight    = canvasCtx.canvas.height;

        // Calculate the draw steps
        var stepX = canvasWidth / (FREQ_MAX - FREQ_MIN);
        var stepY = canvasHeight / (MAG_MAX - MAG_MIN );

        // Clear the canvas
        canvasCtx.fillStyle = "#f0f0f0";
        canvasCtx.fillRect( 0, 0, canvasWidth, canvasHeight );

        // Draw the frequency response
        var eqFreqs = this.eqFreqs;
        var eqMag   = this.musicLayer.getEqResponse( eqFreqs );
        var firstPt = true;
        canvasCtx.beginPath();
        for( var index = 0; index < eqFreqs.length; index++ ) {
            var x = Math.round( (eqFreqs[index] - FREQ_MIN) * stepX );
            var y = canvasHeight -
                        Math.round( (eqMag[index] - MAG_MIN) * stepY );

            if( firstPt ) {
                firstPt = false;
                canvasCtx.moveTo( x, y );
            } else {
                canvasCtx.lineTo( x, y );
            }
        }

        canvasCtx.strokeStyle = "#ff0000";  // red line
        canvasCtx.stroke();

        // Draw the neutral response line
        var neutralY = canvasHeight -
                Math.round( (0 - MAG_MIN) * stepY );

        canvasCtx.beginPath();
        canvasCtx.moveTo( 0, neutralY );
        canvasCtx.lineTo( canvasWidth, neutralY );

        canvasCtx.strokeStyle = "#3030ff";  // blue line
        canvasCtx.stroke();
    }, this );
};

/**
 * Initialize a slider
 * @private
 *
 * @param {String}      elemId          The slider's HTML id
 * @param {AudioParam}  audioParam      The associated audio parameter
 * @param {Number}      stepSize        The slider step size
 * @param {String}      label           The slider label
 * @param {Object}      [override]      The slide overrides
 *
 * @param {String}      [override.value]            Slider value
 * @param {Number}      [override.min]              Minimum slider value
 * @param {Number}      [override.max]              Maximum slider value
 * @param {String}      [override.orientation]      Slider orientation
 */
WebAudioApp.prototype.initSlider = function( elemId,
                                             audioParam,
                                             stepSize,
                                             label,
                                             override ) {

    override = override || {};

    // Initialize the slider
    $( elemId ).slider({
        orientation: override.orientation != null ? override.orientation : "horizontal",

        min: override.min != null ? override.min : audioParam.minValue,
        max: override.max != null ? override.max : audioParam.maxValue,

        step: stepSize,

        value: override.value != null ? override.value : audioParam.value,

        // Add a callback function when the user
        // moves the slider
        slide: function( event, ui ) {
            // Set the volume directly
            audioParam.value = ui.value;

            consoleout( "Adjusted '"
                    + label + "': "
                    + ui.value );
        }
    });
};

/**
 * Initialize a music toggle
 * @private
 *
 * @param {String}  elemId          The button's HTML id
 * @param {String}  groupId         The music group id
 * @param {String}  audioSrc        The audio data's URL
 *
 */
WebAudioApp.prototype.initMusic = function( elemId,
                                            groupId,
                                            audioSrc ) {
    // Initialize the button and disable it
    var jqButton = $( elemId ).button({ disabled: true });

    // Load the audio
    var audioBuffer;
    this.loadAudio( audioSrc, function( audioBufferIn ) {
        // Cache the audio buffer
        audioBuffer = audioBufferIn;

        // Enable the toggle when audio is ready
        jqButton.button( "option", "disabled", false );
    }, this );

    // Initialize the group as necessary
    if( this.musicGroups[ groupId ] == null )
        this.musicGroups[ groupId ] = {};

    var musicLayer = this.musicLayer;
    var musicGroup = this.musicGroups[ groupId ];

    // Register toggle click event
    var me = this;
    jqButton.click(function( event ) {
        // Stopping the active loop?
        if( !$(this).is(':checked') ) {
            consoleout( "Stopping loop '"
                    + musicGroup.activeSrc + "'" );

            // Stop the loop
            musicGroup.activeLoop.stop( 0 );

            // Update the group music state
            musicGroup.activeLoop = null;
            musicGroup.activeSrc = null;
            musicGroup.activeElemId = null;

            // Update the global music state
            me.activeMusicGroupCount--;

            // No more active music? Reset the
            // the next music start time
            if( me.activeMusicGroupCount == 0 )
                me.musicStartSecs = -1;

            return;
        }

        // If we get here, we're starting a loop
        var BUFFER_TIME = 2 / 1000; // 2 ms time buffer

        // Assume the earliest transition time
        var startSecs = me.audioContext.currentTime
                + BUFFER_TIME;

        // If it's not the first music group activated,
        // start playback on the next downbeat
        if( me.activeMusicGroupCount > 0 ) {
            var BPM               = 120;      // 120 bpm
            var BEATS_PER_MEASURE = 4;

            var BEAT_DURATION    = 60 / BPM;
            var MEASURE_DURATION = BEAT_DURATION
                    * BEATS_PER_MEASURE;

            // Calculate the elapsed time for the active loop
            var elapsedSecs = startSecs - me.musicStartSecs;

            if( elapsedSecs > 0 ) {
                // Adjust the transition time to occur
                // on the next downbeat
                var measureSecs = elapsedSecs % MEASURE_DURATION;

                if( measureSecs > 0 )
                    startSecs += MEASURE_DURATION
                            - measureSecs;
            } else {
                // The active loop hasn't started? Use the last
                // transition time
                startSecs = me.musicStartSecs;
            }
        }

        // Does the group have an active loop?
        if( musicGroup.activeLoop != null ) {
            // Stop the last active loop at the playback time
            musicGroup.activeLoop.stop( startSecs );

            // Turn off the last active loop's toggle
            $( musicGroup.activeElemId ).prop('checked', false )
                    .button( "refresh" );
        }

        // Schedule the new loop playback
        var audioNode = musicLayer.playAudioBuffer(
                audioBuffer,
                startSecs,
                true );

        // Output a console message to indicate the status
        if( musicGroup.activeLoop == null )
            consoleout( "Playing loop '"
                    + audioSrc + "'" );
        else
            consoleout( "Transition from loop '"
                    + musicGroup.activeSrc + "' to '"
                    + audioSrc );

        // Update the global music state
        me.musicStartSecs = startSecs;
        if( musicGroup.activeLoop == null )
            me.activeMusicGroupCount++;

        // Update the group music state
        musicGroup.activeLoop = audioNode;
        musicGroup.activeSrc = audioSrc;
        musicGroup.activeElemId = elemId;
    });
};