/* -----------------------------------------------------
 General utilities
 ----------------------------------------------------- */

"use strict";

/**
 * Output text to the output window
 *
 * @param {String}  text
 */
function consoleout( text ) {
    $( "<p/>" )
        .text( text)
        .prependTo( "#output" );
}

/**
 * Assert a condition
 *
 * @param {*}       cond     The condition to test
 * @param {String}  [msg]    The assertion message
 */
function assert( cond, msg ) {
    msg = msg || "Assertion failure";

    if( !Boolean(cond)  )
        throw new msg;
}

/**
 * Calls a function later
 *
 * @param {Number}      timeMs
 * @param {Function}    callbackFn
 * @param {*}           context
 * @param {...}         [var_args]
 */
function later( timeMs, callbackFn, context, var_args ) {
    var fnArgs = arguments.length > 3 ? Array.prototype.slice.call( arguments, 3 ) : [];

    window.setTimeout( function(){
        callbackFn.apply( context, fnArgs );
    }, timeMs );
}
