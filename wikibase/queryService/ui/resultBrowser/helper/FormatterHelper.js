var wikibase = wikibase || {};
wikibase.queryService = wikibase.queryService || {};
wikibase.queryService.ui = wikibase.queryService.ui || {};
wikibase.queryService.ui.resultBrowser = wikibase.queryService.ui.resultBrowser || {};
wikibase.queryService.ui.resultBrowser.helper = wikibase.queryService.ui.resultBrowser.helper || {};

wikibase.queryService.ui.resultBrowser.helper.FormatterHelper = ( function( $, moment ) {
	'use strict';

	var COMMONS_FILE_PATH = 'http://commons.wikimedia.org/wiki/special:filepath/',
		COMMONS_FILE_PATH_MEDIAVIEWER = 'https://commons.wikimedia.org/wiki/File:{FILENAME}',
		DATATYPE_DATETIME = 'http://www.w3.org/2001/XMLSchema#dateTime',
		TYPE_URI = 'uri',
		DATATYPE_MATHML = 'http://www.w3.org/1998/Math/MathML';

	var NUMBER_TYPES = [
			'http://www.w3.org/2001/XMLSchema#double', 'http://www.w3.org/2001/XMLSchema#float',
			'http://www.w3.org/2001/XMLSchema#decimal', 'http://www.w3.org/2001/XMLSchema#integer',
			'http://www.w3.org/2001/XMLSchema#long', 'http://www.w3.org/2001/XMLSchema#int',
			'http://www.w3.org/2001/XMLSchema#short',
			'http://www.w3.org/2001/XMLSchema#nonNegativeInteger',
			'http://www.w3.org/2001/XMLSchema#positiveInteger',
			'http://www.w3.org/2001/XMLSchema#unsignedLong',
			'http://www.w3.org/2001/XMLSchema#unsignedInt',
			'http://www.w3.org/2001/XMLSchema#unsignedShort',
			'http://www.w3.org/2001/XMLSchema#nonPositiveInteger',
			'http://www.w3.org/2001/XMLSchema#negativeInteger'
	];

	/**
	 * Formatting helper provides methods useful for formatting results
	 *
	 * @class wikibase.queryService.ui.resultBrowser.helper.FormatterHelper
	 * @license GNU GPL v2+
	 *
	 * @author Jonas Kress
	 * @constructor
	 * @param {Function} _i18n
	 */
	function SELF( _i18n ) {
		this._i18n = _i18n;
	}

	/**
	 * Format a data row
	 *
	 * @param {Object} row
	 * @param {boolean} embed media files
	 * @return {jQuery} element
	 */
	SELF.prototype.formatRow = function( row, embed ) {
		var self = this,
			$result = $( '<div/>' );

		$.each( row, function( key, value ) {
			if ( self._isLabelField( key, row ) ) {
				return;
			}

			value = $.extend( {
				label: self._getLabel( row, key )
			}, value );
			$result.prepend( $( '<div>' ).append( self.formatValue( value, key, embed ) ) );
		} );

		return $result;
	};

	/**
	 * @param {string} key
	 * @param {object} row
	 * @return {boolean}
	 * @private
	 */
	SELF.prototype._isLabelField = function( key, row ) {
		return key.endsWith( 'Label' ) && typeof row[key.slice( 0, -5 )] !== 'undefined';
	};

	/**
	 * @param {object} row
	 * @param {string} key
	 * @return {string|null}
	 * @private
	 */
	SELF.prototype._getLabel = function( row, key ) {
		var field = row[key + 'Label'];
		return field && field.value || null;
	};

	/**
	 * Format a data value
	 *
	 * @param {Object} data
	 * @param {string} [title]
	 * @param {boolean} [embed] media files
	 * @return {jQuery} element
	 */
	SELF.prototype.formatValue = function( data, title, embed ) {
		var value = data.value,
			$html = $( '<span>' );

		if ( !title ) {
			title = data.dataType || '';
		}

		if ( !data.type ) {
			return $( '<span>' ).text( value ).attr( 'title', title );
		}

		switch ( data.datatype || data.type ) {
		case TYPE_URI:
			var $link = $( '<a>' ).attr( { title: title, href: value, target: '_blank', rel: 'noopener' } );
			$html.append( $link );

			if ( this.isCommonsResource( value ) ) {
				if ( embed ) {
					$link.click( this.handleCommonResourceItem );
					$link.append(
							$( '<img>' ).attr( 'src',
									this.getCommonsResourceFileNameThumbnail( value, '120' ) ) )
							.width( '120' );
				} else {
					$link.attr( { href: COMMONS_FILE_PATH_MEDIAVIEWER.replace( /{FILENAME}/g,
							this.getCommonsResourceFileName( value ) ) } );
					$link.text( 'commons:' +
							decodeURIComponent( this.getCommonsResourceFileName( value ) ) );
					$html.prepend( this.createGalleryButton( value, title ), ' ' );
				}
			} else {
				$link.text( data.label || this.abbreviateUri( value ) );

				if ( this.isEntityUri( value ) ) {
					$html.prepend( this.createExploreButton( value ), ' ' );
				}
			}
			break;
		case DATATYPE_DATETIME:
			if ( !title ) {
				title = this._i18n( 'wdqs-app-result-formatter-title-datetime', 'Raw ISO timestamp' );
			}
			var $dateLabel = $( '<span>' ).text( this._formatDate( value ) );
			$dateLabel.attr( 'title', title + ': ' + value );
			$html.append( $dateLabel );
			break;

		case DATATYPE_MATHML:
			$html.append( $( data.value ) );
			break;

		default:
			var $label = $( '<span>' ).text( value );
			if ( data['xml:lang'] ) {
				$label.attr( 'title', title + ': ' + value + '@' + data['xml:lang'] );
			} else {
				$label.attr( 'title', title );
			}
			$html.append( $label );
		}

		return $html;
	};

	/**
	 * @param {string} dateTime
	 * @return {string}
	 * @private
	 */
	SELF.prototype._formatDate = function( dateTime ) {
		var isBce = false,
			positiveDate = dateTime.replace( /^(?:-\d+|\+?0+\b)/, function( year ) {
				isBce = true;
				return Math.abs( year ) + 1;
			} ),
			moment = this.parseDate( positiveDate ),
			formatted;

		if ( moment.isValid() ) {
			formatted = moment.format( 'll' );
		} else {
			var year = positiveDate.replace( /^\+?(\d+).*/, '$1' );
			formatted = '0000'.slice( year.length ) + year;
		}

		if ( isBce ) {
			// TODO: Translate.
			formatted += ' BCE';
		}

		return formatted;
	};

	/**
	 * Parse dateTime string to Date object
	 * Allows negative years without leading zeros http://www.ecma-international.org/ecma-262/5.1/#sec-15.9.1.15.1
	 *
	 * @param {string} dateTime
	 * @return {Object}
	 */
	SELF.prototype.parseDate = function( dateTime ) {
		// Add leading plus sign if it's missing
		dateTime = dateTime.replace( /^(?![+-])/, '+' );
		// Pad years to 6 digits
		dateTime = dateTime.replace( /^([+-]?)(\d{1,5}\b)/, function( $0, $1, $2 ) {
			return $1 + ( '00000' + $2 ).slice( -6 );
		} );
		// Remove timezone
		dateTime = dateTime.replace( /Z$/, '' );

		return moment( dateTime, moment.ISO_8601 );
	};

	/**
	 * Checks if a given URI appears to be a canonical Wikidata entity URI.
	 *
	 * @param {string} uri
	 * @return {boolean}
	 */
	SELF.prototype.isEntityUri = function( uri ) {
		try{
			return (wikibase.queryService.RdfNamespaces.ENTITY_TYPES[uri.match(/(.*)\/[QP]/)[0]] === null) ? false : true;
		}
		catch(e) {}
		return typeof uri === 'string'
			&& /^https?:\/\/www\.wikidata\.org\/entity\/./.test( uri );
	};

	/**
	 * Creates an explore button
	 *
	 * @return {jQuery}
	 */
	SELF.prototype.createExploreButton = function( url ) {
		var $button = $( '<a href="' + url +
				'" title="Explore item" class="explore glyphicon glyphicon-search" aria-hidden="true">' );
		$button.click( $.proxy( this.handleExploreItem, this ) );

		return $button;
	};

	/**
	 * Checks whether given url is commons resource URL
	 *
	 * @param {string} url
	 * @return {boolean}
	 */
	SELF.prototype.isCommonsResource = function( url ) {
		return url.toLowerCase().startsWith( COMMONS_FILE_PATH.toLowerCase() );
	};

	/**
	 * Returns the file name of a commons resource URL
	 *
	 * @param {string} url
	 * @return {string}
	 */
	SELF.prototype.getCommonsResourceFileName = function( url ) {
		// FIXME: Dots in the constant must be escaped before using it as a regex!
		var regExp = new RegExp( COMMONS_FILE_PATH, 'ig' );

		return decodeURIComponent( url.replace( regExp, '' ) );
	};

	/**
	 * Creates a thumbnail URL from given commons resource URL
	 *
	 * @param {string} url
	 * @param {number} [width]
	 * @return {string}
	 */
	SELF.prototype.getCommonsResourceFileNameThumbnail = function( url, width ) {
		if ( !this.isCommonsResource( url ) ) {
			return url;
		}

		return url.replace( /^http(?=:\/\/)/, 'https' ) + '?width=' + ( width || 400 );
	};

	/**
	 * Creates a gallery button
	 *
	 * @param {string} url
	 * @param {string} galleryId
	 * @return {jQuery}
	 */
	SELF.prototype.createGalleryButton = function( url, galleryId ) {
		var fileName = this.getCommonsResourceFileName( url ),
			thumbnail = this.getCommonsResourceFileNameThumbnail( url, 900 );

		var $button = $( '<a>' ).attr( {
			title: 'Show Gallery',
			href: thumbnail,
			'aria-hidden': 'true',
			'class': 'gallery glyphicon glyphicon-picture',
			'data-gallery': 'G_' + galleryId,
			'data-title': decodeURIComponent( fileName )
		} );

		$button.click( this.handleCommonResourceItem );

		return $button;
	};

	/**
	 * Produce abbreviation of the URI.
	 *
	 * @param {string} uri
	 * @return {string}
	 */
	SELF.prototype.abbreviateUri = function( uri ) {
		var NAMESPACE_SHORTCUTS = wikibase.queryService.RdfNamespaces.NAMESPACE_SHORTCUTS,
			nsGroup,
			ns,
			length = 0,
			longestNs;

		for ( nsGroup in NAMESPACE_SHORTCUTS ) {
			for ( ns in NAMESPACE_SHORTCUTS[nsGroup] ) {
				if ( uri.indexOf( NAMESPACE_SHORTCUTS[nsGroup][ns] ) === 0 ) {
					if ( NAMESPACE_SHORTCUTS[nsGroup][ns].length > length ) {
						length = NAMESPACE_SHORTCUTS[nsGroup][ns].length;
						longestNs = ns;
					}
				}
			}
		}
		if ( longestNs ) {
			return longestNs + ':' + uri.substr( length );
		} else {
			return '<' + uri + '>';
		}
	};

	/**
	 * Handler for explore links
	 */
	SELF.prototype.handleExploreItem = function( e ) {
		var url = $( e.target ).attr( 'href' );
		e.preventDefault();

		var lang = $.i18n && $.i18n().locale || 'en',
			query = 'SELECT ?item ?itemLabel WHERE { BIND( <' + url + '> as ?item ).	SERVICE wikibase:label { bd:serviceParam wikibase:language "' + lang + '" } }',
			embedUrl = 'embed.html#' + encodeURIComponent( '#defaultView:Graph\n' + query );

		$( '.explorer-panel .panel-body' ).html( $( '<iframe frameBorder="0" scrolling="no"></iframe>' ).attr( 'src', embedUrl ) );
		$( '.explorer-panel' ).show();

		return false;
	};

	/**
	 * Handler for commons resource links
	 */
	SELF.prototype.handleCommonResourceItem = function( e ) {
		e.preventDefault();

		$( this ).ekkoLightbox( {
			'scale_height': true
		} );
	};

	/**
	 * Checks whether the current cell contains a label:
	 * Has either a language property, or has the "literal" type without a datatype.
	 *
	 * @param {Object} cell
	 * @return {boolean}
	 */
	SELF.prototype.isLabel = function( cell ) {
		if ( !cell ) {
			return false;
		}

		return 'xml:lang' in cell
			|| ( cell.type === 'literal' && !cell.datatype );
	};

	/**
	 * Checks whether the current cell contains a number
	 *
	 * @param {Object} cell
	 * @return {boolean}
	 */
	SELF.prototype.isNumber = function( cell ) {
		return cell
			&& cell.datatype
			&& NUMBER_TYPES.indexOf( cell.datatype ) !== -1;
	};

	/**
	 * Checks whether the current cell is date time
	 *
	 * @param {Object} cell
	 * @return {boolean}
	 */
	SELF.prototype.isDateTime = function( cell ) {
		return cell
			&& cell.datatype === DATATYPE_DATETIME;
	};

	/**
	 * Checks whether the current cell is a WD entity URI
	 *
	 * @param {Object} cell
	 * @return {boolean}
	 */
	SELF.prototype.isEntity = function( cell ) {
		return cell
			&& cell.value
			&& this.isEntityUri( cell.value );
	};

	/**
	 * Checks whether the current cell is a color string according to the P465 format
	 *
	 * @param {Object} cell
	 * @return {boolean}
	 */
	SELF.prototype.isColor = function ( cell ) {
		return cell
			&& cell.type === 'literal'
			&& cell.value
			&& /^([\dA-F]{1,2}){3}$/i.test( cell.value );
	};

	/**
	 * Returns an HTML color string for the current cell
	 *
	 * @param {Object} cell
	 * @return {string}
	 */
	SELF.prototype.getColorForHtml = function ( cell ) {
		return '#' + cell.value;
	};

	/**
	 * Calculate the luminance of the given sRGB color.
	 *
	 * This uses the reverse sRGB transformation,
	 * as documented on https://en.wikipedia.org/wiki/SRGB#The_reverse_transformation,
	 * to calculate the luminance (Y coordinate in the CIE XYZ model).
	 *
	 * @param {string} color as six hex digits (no #)
	 * @return {Number} luminance of the color, or NaN if the color string is invalid
	 */
	SELF.prototype.calculateLuminance = function( color ) {
		var r = parseInt( color.substr( 1, 2 ), 16 ) / 255,
			g = parseInt( color.substr( 3, 2 ), 16 ) / 255,
			b = parseInt( color.substr( 5, 2 ), 16 ) / 255;

		if ( isFinite( r ) && isFinite( g ) && isFinite( b ) ) {
			// linearize gamma-corrected sRGB values
			r = r <= 0.04045 ? r / 12.92 : Math.pow( ( r + 0.055 ) / 1.055, 2.4 );
			g = g <= 0.04045 ? g / 12.92 : Math.pow( ( g + 0.055 ) / 1.055, 2.4 );
			b = b <= 0.04045 ? b / 12.92 : Math.pow( ( b + 0.055 ) / 1.055, 2.4 );
			// calculate luminance using Rec. 709 coefficients
			var luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
			return luminance;
		} else {
			return NaN;
		}
	};

	/**
	 * Gets a list of column names from a result browser option
	 * specifying one or more corresponding variable names.
	 * (The variable names start with a question mark,
	 * the returned column names don’t.)
	 *
	 * @param {string[]|string} optionValue
	 * @return {string[]}
	 */
	SELF.prototype.getColumnNamesOption = function( optionValue ) {
		if ( !Array.isArray( optionValue ) ) {
			optionValue = [ optionValue ];
		}
		optionValue = optionValue.filter( function( variableName ) {
			if ( !variableName.startsWith( '?' ) ) {
				window.console.warn(
					'column name ' + variableName + ' is not a variable name, ignoring'
				);
				return false;
			}
			return true;
		} );
		return optionValue.map( function( variableName ) {
			return variableName.substring( 1 );
		} );
	};

	/**
	 * @see AbstractResultBrowser._i18n
	 */
	SELF.prototype._i18n = null;

	return SELF;
}( jQuery, moment ) );
