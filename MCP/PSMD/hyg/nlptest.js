//var nlp = require( 'wink-nlp-utils' );
import nlp from 'wink-nlp-utils';

// Tokenize a sentence.
var s = 'For details on wink, check out http://winkjs.org/ URL!';
console.log( nlp.string.tokenize( s, true ) );