var wikibase = wikibase || {};
wikibase.queryService = wikibase.queryService || {};
wikibase.queryService.ui = wikibase.queryService.ui || {};

wikibase.queryService.ui.QueryExampleDialog = ( function( $ ) {
	'use strict';

	var TRACKING_NAMESPACE = 'wikibase.queryService.ui.examples.';

	/**
	 * A ui dialog for selecting a query example
	 *
	 * @class wikibase.queryService.ui.QueryExampleDialog
	 * @license GNU GPL v2+
	 *
	 * @author Jonas Kress
	 * @author Florian Rämisch, <raemisch@ub.uni-leipzig.de>
	 * @constructor
	 *
	 * @param {jQuery} $element
	 * @param {wikibase.queryService.api.QuerySamples} querySamplesApi
	 * @param {Function} callback that is called when selecting an example
	 */
	function SELF( $element, querySamplesApi, callback, previewUrl ) {

		this._$element = $element;
		this._querySamplesApi = querySamplesApi;
		this._callback = callback;
		this._previewUrl = previewUrl;

		this._init();
	}

	/**
	 * @property {wikibase.queryService.api.QuerySamples}
	 * @private
	 */
	SELF.prototype._querySamplesApi = null;

	/**
	 * @property {wikibase.queryService.api.Wikibase}
	 * @private
	 */
	SELF.prototype._wikibaseApi = null;

	/**
	 * @property {Function}
	 * @private
	 */
	SELF.prototype._callback = null;

	/**
	 * @property {string}
	 * @private
	 */
	SELF.prototype._previewUrl = null;

	/**
	 * @property {Function}
	 * @private
	 */
	SELF.prototype._examples = null;

	/**
	 * @property {wikibase.queryService.api.Tracking}
	 * @private
	 */
	SELF.prototype._trackingApi = null;

	/**
	 * Initialize private members and call delegate to specific init methods
	 *
	 * @private
	 */
	SELF.prototype._init = function() {
		if ( !this._querySamplesApi ) {
			this._querySamplesApi = new wikibase.queryService.api.QuerySamples();
		}

		if ( !this._trackingApi ) {
			this._trackingApi = new wikibase.queryService.api.Tracking();
		}

		this._wikibaseApi = new wikibase.queryService.api.Wikibase();
		this._wikibaseApi.setLanguage( this._querySamplesApi.getLanguage() );

		this._initFilter();
		this._initExamples();

		var self = this;
		this._$element.focus( function() {
			self._$element.find( '.tableFilter' ).focus();
		} );
	};

	/**
	 * @private
	 */
	SELF.prototype._initFilter = function() {
		var self = this;

		this._$element.find( '.tableFilter' ).keyup( $.proxy( this._filterTable, this ) );

		// tags
		this._$element.find( '.tagFilter' ).tags( {
			afterAddingTag: $.proxy( this._filterTable, this ),
			afterDeletingTag: function() {
				self._filterTable();
				self._drawTagCloud( true );
			}
		} );
	};

	/**
	 * @private
	 */
	SELF.prototype._initExamples = function() {
		var self = this,
			category = null;

		this._querySamplesApi.getExamples().then( function( examples ) {
			self._examples = examples;
			self._initTagCloud();
			self._updateExamplesCount( examples.length );

			$.each( examples, function( key, example ) {
				if ( example.category !== category ) {
					category = example.category;
					self._$element.find( '.searchable' ).append( $( '<tr>' ).addClass( 'active' )
							.append( $( '<td colspan="4">' ).text( category ) ) );
				}
				self._addExample( example.title, example.query, example.href, example.tags, category );
			} );
		} );
	};

	/**
	 * @private
	 */
	SELF.prototype._initTagCloud = function() {
		var self = this;

		var interval = window.setInterval( function() {
			if ( self._$element.is( ':visible' ) ) {
				self._drawTagCloud();
				clearInterval( interval );
			}
		}, 300 );
	};

	/**
	 * @private
	 */
	SELF.prototype._drawTagCloud = function( redraw ) {
		var self = this,
			jQCloudTags = [];

		this._getCloudTags().then( function ( tags ) {
			var tagCloud = $( '.tagCloud' );
			$.each( tags, function ( i, tag ) {
				var label = tag.label + ' (' + tag.id + ')';

				jQCloudTags.push( {
					text: label,
					weight: tag.weight,
					link: '#',
					html: {
						title: '(' + tag.weight + ')',
						'data-id': tag.id
					},
					handlers: {
						click: function ( e ) {
							self._$element.find( '.tagFilter' ).tags().addTag( $( this ).text() );
							self._drawTagCloud( true );
							return false;
						}
					}
				} );
			} );

			if ( redraw ) {
				tagCloud.jQCloud( 'update', jQCloudTags );
				return;
			}

			tagCloud.jQCloud( jQCloudTags, {
				delayedMode: true,
				autoResize: true
			} );

		} );
	};

	/**
	 * @private
	 */
	SELF.prototype._getCloudTags = function() {
		var self = this,
			filterTags = self._$element.find( '.tagFilter' ).tags().getTags();

		// filter tags that don't effect the filter for examples
		var tagsFilter = function ( tags ) {
			return filterTags.every( function ( selectedTag ) {
				return tags.indexOf( selectedTag.match( /\((.*)\)/ )[1] ) !== -1;
			} );
		};

		// filter selected tags from tag cloud
		var tagFilter = function ( tag ) {
			var selectedTags = filterTags.map(
					function ( v ) {
						return v.match( /\((.*)\)/ )[1];
					} );

			return selectedTags.indexOf( tag ) !== -1;
		};

		var tagCloud = {};
		$.each( self._examples, function( key, example ) {
			if ( !tagsFilter( example.tags ) ) {
				return;
			}

			$.each( example.tags, function( key, tag ) {
				if ( tagFilter( tag ) ) {
					return;
				}

				if ( !tagCloud[tag] ) {
					tagCloud[tag] = { id: tag, weight: 1 };
				} else {
					tagCloud[tag].weight++;
				}
			} );
		} );

		tagCloud = _.compact( tagCloud ).sort( function ( a, b ) {
			return b.weight - a.weight;
		} ).slice( 0, 50 );

		return this._wikibaseApi.getLabels( tagCloud.map( function ( v ) {
			return v.id;
		} ) ).then( function ( data ) {
			tagCloud.forEach( function ( tag ) {
				tag.label = _.compact( data.entities[tag.id].labels )[0].value;
			} );
			return tagCloud;
		} );
	};

	/**
	 * @private
	 */
	SELF.prototype._addExample = function( title, query, href, tags, category ) {
		var self = this,
			$link = $( '<a title="Select" data-dismiss="modal">' ).text( title ).attr( 'href', '#' )
					.click( function() {
						self._callback( query, title );
						self._track( 'select' );
						self._track( 'select.category.' + category.replace( /[^a-zA-Z0-9]/g, '_' ) );
					} ),
			$edit = $( '<a>' )
				.attr( { title: 'Edit', href: href, target: '_blank' } )
				.append( '<span>' ).addClass( 'glyphicon glyphicon-pencil' )
				.click( function() {
					self._track( 'edit' );
				} ),

			$source = $( '<span>' ).addClass( 'glyphicon glyphicon-eye-open' ).popover(
				{
					placement: 'bottom',
					trigger: 'hover',
					container: 'body',
					title: self._i18n( 'wdqs-dialog-examples-preview-query', 'Preview query' ),
					content: $( '<pre style="white-space:pre-line; word-break:normal;"/>' ).text( query ),
					html: true
				} ),
			$preview = $( '<a href="#">' ).addClass( 'glyphicon glyphicon-camera' ).clickover(
				{
					placement: 'left',
					'global_close': true,
                    'esc_close': true,
					trigger: 'click',
					container: 'body',
					title: self._i18n( 'wdqs-dialog-examples-preview-result', 'Preview result' ),
					content: $( '<iframe width="400" height="350" frameBorder="0" src="' +
							( self._previewUrl || 'embed.html#' ) +	encodeURIComponent( query ) + '">' ),
					html: true
				} )
				.click( function() {
					self._track( 'preview' );
				} );

		$( '.exampleTable' ).scroll( function() {
			if ( $preview.clickover ) {
				$preview.clickover( 'hide' ).removeAttr( 'data-clickover-open' );
			}
		} );

		var example = $( '<tr>' );
		example.append( $( '<td>' ).append( $link ).append( ' ', $edit ) );
		example.append( $( '<td>' ).addClass( 'exampleIcons' ).append( $preview ) );
		example.append( $( '<td>' ).addClass( 'exampleIcons' ).append( $source ) );
		example.append( $( '<td>' ).text( tags.join( '|' ) ).hide() );
		example.append( $( '<td>' ).text( query ).hide() );

		this._$element.find( '.searchable' ).append( example );
	};

	/**
	 * @private
	 */
	SELF.prototype._filterTable = function() {
		var filter = this._$element.find( '.tableFilter' ),
			// FIXME: This crashs when the user enters an invalid regex. e.g. ".**".
			filterRegex = new RegExp( filter.val(), 'i' );

		var tags = this._$element.find( '.tagFilter' ).tags().getTags();

		var tagFilter = function( text ) {
			var matches = true;
			text = text.toLowerCase();

			$.each( tags, function( key, tag ) {
				if ( text.indexOf( tag.toLowerCase().match( /\((.*)\)/ )[1] ) === -1 ) {
					matches = false;
				}
			} );

			return matches;
		};

		this._$element.find( '.searchable tr' ).hide();
		var $matchingElements = this._$element.find( '.searchable tr' ).filter( function() {
			return filterRegex.test( $( this ).text() ) && tagFilter( $( this ).text() );
		} );

		$matchingElements.show();
		$matchingElements.each( function( i, el ) {
			$( el ).prevAll( 'tr.active' ).first().show();
		} );
		this._updateExamplesCount( $matchingElements.length );
	};

	/**
	 * @private
	 */
	SELF.prototype._updateExamplesCount = function( count ) {
		this._$element.find( '.count' ).text( count );
	};

	/**
	 * @private
	 */
	SELF.prototype._track = function( metricName, value, valueType ) {
		this._trackingApi.track( TRACKING_NAMESPACE + metricName, value, valueType );
	};

	/**
	 * @private
	 */
	SELF.prototype._i18n = function( key, message, args ) {
		var i18nMessage = null;

		if ( $.i18n ) {
			i18nMessage = $.i18n.apply( $, [ key ].concat( args || [] ) );
			if ( i18nMessage !== key ) {
				return i18nMessage;
			}
		}

		i18nMessage = message;
		if ( args ) {
			$.each( args, function( index, arg ) {
				i18nMessage = i18nMessage.replace(
					new RegExp( '\\$' + ( index + 1 ), 'g' ),
					arg
				);
			} );
		}

		return i18nMessage;
	};

	return SELF;
}( jQuery ) );
