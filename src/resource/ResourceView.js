
setDefaults({
	allDaySlot: true,
	allDayText: 'all-day',

	scrollTime: '06:00:00',

	slotDuration: '00:30:00',

	axisFormat: generateAgendaAxisFormat,
	timeFormat: {
		resource: generateAgendaTimeFormat
	},

	dragOpacity: {
		resource: .5
	},
	minTime: '00:00:00',
	maxTime: '24:00:00',
	slotEventOverlap: true
});


// TODO: make it work in quirks mode (event corners, all-day height)
// TODO: test liquid width, especially in IE6

function ResourceView(element, calendar, viewName) {
  var t = this;


  // exports
	t.renderResource = renderResource;
	t.setWidth = setWidth;
	t.setHeight = setHeight;
	t.afterRender = afterRender;
	t.computeDateTop = computeDateTop;
	t.getIsCellAllDay = getIsCellAllDay;
	t.allDayRow = function() { return allDayRow; }; // badly named
	t.getCoordinateGrid = function() { return coordinateGrid; }; // specifically for AgendaEventRenderer
	t.getHoverListener = function() { return hoverListener; };
	t.colLeft = colLeft;
	t.colRight = colRight;
	t.colContentLeft = colContentLeft;
	t.colContentRight = colContentRight;
	t.getDaySegmentContainer = function() { return daySegmentContainer; };
	t.getSlotSegmentContainer = function() { return slotSegmentContainer; };
	t.getAnnotationSegmentContainer = function() { return annotationSegmentContainer; };
	t.getSlotContainer = function() { return slotContainer; };
	t.getRowCnt = function() { return 1; };
	t.getColCnt = function() { return 1; };
	t.getColWidth = function() { return colWidth; };
	t.getSnapHeight = function() { return snapHeight; };
	t.getSnapDuration = function() { return snapDuration; };
	t.getSlotHeight = function() { return slotHeight; };
	t.getSlotDuration = function() { return slotDuration; };
	t.getMinTime = function() { return minTime; };
	t.getMaxTime = function() { return maxTime; };
	t.defaultSelectionEnd = defaultSelectionEnd;
	t.renderDayOverlay = renderDayOverlay;
	t.renderSelection = renderSelection;
	t.clearSelection = clearSelection;
	t.reportDayClick = reportDayClick; // selection mousedown hack
	t.dragStart = dragStart;
	t.dragStop = dragStop;
	t.getResources = calendar.fetchResources;
	t.renderAnnotations = renderAnnotations;

	// imports
	View.call(t, element, calendar, viewName);
	t.eventDrop = eventDrop;
	t.eventResize = eventResize;

	OverlayManager.call(t);
	SelectionManager.call(t);
	ResourceEventRenderer.call(t);
	var opt = t.opt;
	var trigger = t.trigger;
	var renderOverlay = t.renderOverlay;
	var clearOverlays = t.clearOverlays;
	var reportSelection = t.reportSelection;
	var unselect = t.unselect;
	var slotSegHtml = t.slotSegHtml;
	var cellToDate = t.cellToDate;
	var dateToCell = t.dateToCell;
	var rangeToSegments = t.rangeToSegments;
	var formatDate = calendar.formatDate;
	var calculateWeekNumber = calendar.calculateWeekNumber;
	var reportEventChange = calendar.reportEventChange;

	// locals

	var dayTable;
	var dayHead;
	var dayHeadCells;
	var dayBody;
	var dayBodyCells;
	var dayBodyCellInners;
	var dayBodyCellContentInners;
	var dayBodyFirstCell;
	var dayBodyFirstCellStretcher;
	var slotLayer;
	var daySegmentContainer;
	var allDayTable;
	var allDayRow;
	var slotScroller;
	var slotContainer;
	var slotSegmentContainer;
	var slotTable;
	var selectionHelper;

	var viewWidth;
	var viewHeight;
	var axisWidth;
	var colWidth;
	var gutterWidth;

	var slotDuration;
	var slotHeight; // TODO: what if slotHeight changes? (see issue 650)

	var snapDuration;
	var snapRatio; // ratio of number of "selection" slots to normal slots. (ex: 1, 2, 4)
	var snapHeight; // holds the pixel hight of a "selection" slot

	var colCnt;
	var slotCnt;
	var coordinateGrid;
	var hoverListener;
	var colPositions;
	var colContentPositions;
	var slotTopCache = {};

	var tm;
	var rtl;
	var minTime;
	var maxTime;
	var colFormat;
	var resources = t.getResources;

	var annotationSegmentContainer;

	/* Rendering
	-----------------------------------------------------------------------------*/


	disableTextSelection(element.addClass('fc-agenda'));


	function renderResource(resourceColumnsCnt) {
		colCnt = resourceColumnsCnt;
		updateOptions();

		if (!dayTable) { // first time rendering?
			buildSkeleton(); // builds day table, slot area, events containers
		}
		else {
			buildDayTable(); // rebuilds day table
		}
	}

	function updateOptions() {

		tm = opt('theme') ? 'ui' : 'fc';
		rtl = opt('isRTL');
		colFormat = opt('columnFormat');

		minTime = moment.duration(opt('minTime'));
		maxTime = moment.duration(opt('maxTime'));

		slotDuration = moment.duration(opt('slotDuration'));
		snapDuration = opt('snapDuration');
		snapDuration = snapDuration ? moment.duration(snapDuration) : slotDuration;
	}



	/* Build DOM
	-----------------------------------------------------------------------*/


	function buildSkeleton() {
		var s;
		var headerClass = tm + "-widget-header";
		var contentClass = tm + "-widget-content";
		var slotTime;
		var slotDate;
		var minutes;
		var slotNormal = slotDuration.asMinutes() % 15 === 0;

		buildDayTable();

		slotLayer =
			$("<div style='position:absolute;z-index:2;left:0;width:100%'/>")
				.appendTo(element);

		if (opt('allDaySlot')) {

			daySegmentContainer =
				$("<div class='fc-event-container' style='position:absolute;z-index:8;top:0;left:0'/>")
					.appendTo(slotLayer);

			s =
				"<table style='width:100%' class='fc-agenda-allday' cellspacing='0'>" +
				"<tr>" +
				"<th class='" + headerClass + " fc-agenda-axis'>" +
				(
					opt('allDayHTML') ||
					htmlEscape(opt('allDayText'))
				) +
				"</th>" +
				"<td>" +
				"<div class='fc-day-content'><div style='position:relative'/></div>" +
				"</td>" +
				"<th class='" + headerClass + " fc-agenda-gutter'>&nbsp;</th>" +
				"</tr>" +
				"</table>";
			allDayTable = $(s).appendTo(slotLayer);
			allDayRow = allDayTable.find('tr');

			dayBind(allDayRow.find('td'));

			slotLayer.append(
				"<div class='fc-agenda-divider " + headerClass + "'>" +
				"<div class='fc-agenda-divider-inner'/>" +
				"</div>"
			);

		}else{

			daySegmentContainer = $([]); // in jQuery 1.4, we can just do $()

		}

		slotScroller =
			$("<div style='position:absolute;width:100%;overflow-x:hidden;overflow-y:auto'/>")
				.appendTo(slotLayer);

		slotContainer =
			$("<div style='position:relative;width:100%;overflow:hidden'/>")
				.appendTo(slotScroller);

		slotSegmentContainer =
			$("<div class='fc-event-container' style='position:absolute;z-index:8;top:0;left:0'/>")
				.appendTo(slotContainer);

		annotationSegmentContainer =
			$("<div class='slot-segment-container' style='position:absolute;z-index:-1;top:0;left:0'/>")
				.appendTo(slotContainer);

		s =
			"<table class='fc-agenda-slots' style='width:100%' cellspacing='0'>" +
			"<tbody>";

		slotTime = moment.duration(+minTime); // i wish there was .clone() for durations
		slotCnt = 0;
		while (slotTime < maxTime) {
			slotDate = t.start.clone().time(slotTime); // will be in UTC but that's good. to avoid DST issues
			minutes = slotDate.minutes();
			s +=
				"<tr class='fc-slot" + slotCnt + ' ' + (!minutes ? '' : 'fc-minor') + "'>" +
				"<th class='fc-agenda-axis " + headerClass + "'>" +
				((!slotNormal || !minutes) ?
					htmlEscape(formatDate(slotDate, opt('axisFormat'))) :
					'&nbsp;'
					) +
				"</th>" +
				"<td class='" + contentClass + "'>" +
				"<div style='position:relative'>&nbsp;</div>" +
				"</td>" +
				"</tr>";
			slotTime.add(slotDuration);
			slotCnt++;
		}

		s +=
			"</tbody>" +
			"</table>";

		slotTable = $(s).appendTo(slotContainer);

		slotBind(slotTable.find('td'));
	}



	/* Build Day Table
	-----------------------------------------------------------------------*/


	function buildDayTable() {
		var html = buildDayTableHTML();

		if (dayTable) {
			dayTable.remove();
		}
		dayTable = $(html).appendTo(element);

		dayHead = dayTable.find('thead');
		dayHeadCells = dayHead.find('th').slice(1, -1); // exclude gutter
		dayBody = dayTable.find('tbody');
		dayBodyCells = dayBody.find('td').slice(0, -1); // exclude gutter
		dayBodyCellInners = dayBodyCells.find('> div');
		dayBodyCellContentInners = dayBodyCells.find('.fc-day-content > div');

		dayBodyFirstCell = dayBodyCells.eq(0);
		dayBodyFirstCellStretcher = dayBodyCellInners.eq(0);

		markFirstLast(dayHead.add(dayHead.find('tr')));
		markFirstLast(dayBody.add(dayBody.find('tr')));

		// TODO: now that we rebuild the cells every time, we should call dayRender
	}


	function buildDayTableHTML() {
		var html =
			"<table style='width:100%' class='fc-agenda-days fc-border-separate' cellspacing='0'>" +
			buildDayTableHeadHTML() +
			buildDayTableBodyHTML() +
			"</table>";

		return html;
	}


	function buildDayTableHeadHTML() {
		var headerClass = tm + "-widget-header";
		var date;
		var html = '';
		var weekText;
		var col;

		html +=
			"<thead>" +
			"<tr>";

		if (opt('weekNumbers')) {
			date = cellToDate(0, 0);
			weekText = calculateWeekNumber(date);
			if (rtl) {
				weekText += opt('weekNumberTitle');
			}
			else {
				weekText = opt('weekNumberTitle') + weekText;
			}
			html +=
				"<th class='fc-agenda-axis fc-week-number " + headerClass + "'>" +
				htmlEscape(weekText) +
				"</th>";
		}
		else {
			html += "<th class='fc-agenda-axis " + headerClass + "'>&nbsp;</th>";
		}

		for (col=0; col<colCnt; col++) {
		  var resource = resources()[col];
		  var classNames = [ // added
	          'fc-col' + col,
	          resource.className,
	          headerClass,
	          'resource-id' + resource.id
	        ];

	      html +=
					"<th class='" + classNames.join(' ') + "'>" +
					htmlEscape(resource.name) +
					"</th>";
		}

		html +=
			"<th class='fc-agenda-gutter " + headerClass + "'>&nbsp;</th>" +
			"</tr>" +
			"</thead>";

		return html;
	}


	function buildDayTableBodyHTML() {
		var headerClass = tm + "-widget-header"; // TODO: make these when updateOptions() called
		var contentClass = tm + "-widget-content";
		var date;
		var today = calendar.getNow().stripTime();
		var col;
		var cellsHTML;
		var cellHTML;
		var classNames;
		var html = '';

		html +=
			"<tbody>" +
			"<tr>" +
			"<th class='fc-agenda-axis " + headerClass + "'>&nbsp;</th>";

		cellsHTML = '';

		for (col=0; col<(colCnt||1); col++) {
			var resource = resources()[col];
			date = t.intervalStart.clone();

			classNames = [
				'fc-col' + col,
				'fc-' + dayIDs[date.day()],
				contentClass
			];
			if (resource && resource.className) {
				classNames.push(resource.className);
			}
			if (date.isSame(today, 'day')) {
				classNames.push(
					tm + '-state-highlight',
					'fc-today'
				);
			}
			else if (date < today) {
				classNames.push('fc-past');
			}
			else {
				classNames.push('fc-future');
			}

			cellHTML =
				"<td class='" + classNames.join(' ') + "'>" +
				"<div>" +
				"<div class='fc-day-content'>" +
				"<div style='position:relative'>&nbsp;</div>" +
				"</div>" +
				"</div>" +
				"</td>";

			cellsHTML += cellHTML;
		}

		html += cellsHTML;
		html +=
			"<td class='fc-agenda-gutter " + contentClass + "'>&nbsp;</td>" +
			"</tr>" +
			"</tbody>";

		return html;
	}


	// TODO: data-date on the cells



	/* Dimensions
	-----------------------------------------------------------------------*/


	function setHeight(height) {
		if (height === undefined) {
			height = viewHeight;
		}
		viewHeight = height;
		slotTopCache = {};

		var headHeight = dayBody.position().top;
		var allDayHeight = slotScroller.position().top; // including divider
		var bodyHeight = Math.min( // total body height, including borders
			height - headHeight,   // when scrollbars
			slotTable.height() + allDayHeight + 1 // when no scrollbars. +1 for bottom border
		);

		dayBodyFirstCellStretcher
			.height(bodyHeight - vsides(dayBodyFirstCell));

		slotLayer.css('top', headHeight);

		slotScroller.height(bodyHeight - allDayHeight - 1);

		// the stylesheet guarantees that the first row has no border.
		// this allows .height() to work well cross-browser.
		var slotHeight0 = slotTable.find('tr:first').height() + 1; // +1 for bottom border
		var slotHeight1 = slotTable.find('tr:eq(1)').height();
		// HACK: i forget why we do this, but i think a cross-browser issue
		slotHeight = (slotHeight0 + slotHeight1) / 2;

		snapRatio = slotDuration / snapDuration;
		snapHeight = slotHeight / snapRatio;
	}


	function setWidth(width) {
		viewWidth = width;
		colPositions.clear();
		colContentPositions.clear();

		var axisFirstCells = dayHead.find('th:first');
		if (allDayTable) {
			axisFirstCells = axisFirstCells.add(allDayTable.find('th:first'));
		}
		axisFirstCells = axisFirstCells.add(slotTable.find('th:first'));

		axisWidth = 0;
		setOuterWidth(
			axisFirstCells
				.width('')
				.each(function(i, _cell) {
					axisWidth = Math.max(axisWidth, $(_cell).outerWidth());
				}),
			axisWidth
		);

		var gutterCells = dayTable.find('.fc-agenda-gutter');
		if (allDayTable) {
			gutterCells = gutterCells.add(allDayTable.find('th.fc-agenda-gutter'));
		}

		var slotTableWidth = slotScroller[0].clientWidth; // needs to be done after axisWidth (for IE7)

		gutterWidth = slotScroller.width() - slotTableWidth;
		if (gutterWidth) {
			setOuterWidth(gutterCells, gutterWidth);
			gutterCells
				.show()
				.prev()
				.removeClass('fc-last');
		}else{
			gutterCells
				.hide()
				.prev()
				.addClass('fc-last');
		}

		colWidth = Math.floor((slotTableWidth - axisWidth) / colCnt);
		setOuterWidth(dayHeadCells.slice(0, -1), colWidth);
	}



	/* Scrolling
	-----------------------------------------------------------------------*/


	function resetScroll() {
		var top = computeTimeTop(
			moment.duration(opt('scrollTime'))
		) + 1; // +1 for the border

		function scroll() {
			slotScroller.scrollTop(top);
		}

		scroll();
		setTimeout(scroll, 0); // overrides any previous scroll state made by the browser
	}


	function afterRender() { // after the view has been freshly rendered and sized
		resetScroll();
	}



	/* Slot/Day clicking and binding
	-----------------------------------------------------------------------*/


	function dayBind(cells) {
		cells.click(slotClick)
			.mousedown(daySelectionMousedown);
	}


	function slotBind(cells) {
		cells.click(slotClick)
			.mousedown(slotSelectionMousedown);
	}


	function slotClick(ev) {
		if (!opt('selectable')) { // if selectable, SelectionManager will worry about dayClick

			var col = Math.min(colCnt-1, Math.floor((ev.pageX - dayTable.offset().left - axisWidth) / colWidth));
			var date = cellToDate(0, 0);
			var match = this.parentNode.className.match(/fc-slot(\d+)/); // TODO: maybe use data

			ev.data = resources()[col];  // added

			if (match) {
				var slotIndex = parseInt(match[1], 10);
				date.add(minTime + slotIndex * slotDuration);
				date = calendar.rezoneDate(date);
				trigger(
					'dayClick',
					dayBodyCells[col],
					date,
					ev
				);
			}else{
				trigger(
					'dayClick',
					dayBodyCells[col],
					date,
					ev
				);
			}
		}
	}



	/* Semi-transparent Overlay Helpers
	-----------------------------------------------------*/
	// TODO: should be consolidated with BasicView's methods


	function renderDayOverlay(overlayStart, overlayEnd, refreshCoordinateGrid, col) { // overlayEnd is exclusive
		if (refreshCoordinateGrid) {
			coordinateGrid.build();
		}

		var segments = rangeToSegments(overlayStart, overlayEnd);

		for (var i=0; i<segments.length; i++) {
			var segment = segments[i];
			dayBind(
				renderCellOverlay(
					segment.row,
					col,
					segment.row,
					col
				)
			);
		}
	}


	function renderCellOverlay(row0, col0, row1, col1) { // only for all-day?
		var rect = coordinateGrid.rect(row0, col0, row1, col1, slotLayer);
		return renderOverlay(rect, slotLayer);
	}


	function renderSlotOverlay(overlayStart, overlayEnd, col) {
		// normalize, because dayStart/dayEnd have stripped time+zone
		overlayStart = overlayStart.clone().stripZone();
		overlayEnd = overlayEnd.clone().stripZone();

		var dayStart = cellToDate(0, 0);
		var dayEnd = dayStart.clone().add(1, 'days');

		var stretchStart = dayStart < overlayStart ? overlayStart : dayStart; // the max of the two
		var stretchEnd = dayEnd < overlayEnd ? dayEnd : overlayEnd; // the min of the two

		if (stretchStart < stretchEnd) {
			var rect = coordinateGrid.rect(0, col, 0, col, slotContainer); // only use it for horizontal coords
			var top = computeDateTop(stretchStart, dayStart);
			var bottom = computeDateTop(stretchEnd, dayStart);

			rect.top = top;
			rect.height = bottom - top;
			slotBind(
				renderOverlay(rect, slotContainer)
			);
		}
	}

	/* Render annotations
	-----------------------------------------------------------------------------*/
	function renderAnnotations(annotations) {
		var html = '';
		for (var i=0; i < annotations.length; i++) {
			var ann = annotations[i];
			var start = moment(ann.start);
			var end = moment(ann.end);
			if (start >= this.start && end <= this.end) {
				if(ann.resources instanceof Array){
					for(var j=0; j < ann.resources.length; j++){
						var resource = ann.resources[j];
						var dayIndex = getIndexOfResource(resource);

						if(dayIndex !== undefined){
							var top = computeTimeTop(moment.duration(ann.start));
							var bottom = computeTimeTop(moment.duration(ann.end));
							var height = bottom - top;

							var left = colContentLeft(dayIndex) - 2;
							var right = colContentRight(dayIndex) + 3;
							var width = right - left;

							var cls = '';
							if (ann.cls) {
								cls = ' ' + ann.cls;
							}

							var colors = '';
							if (ann.color) {
								colors = 'color:' + ann.color + ';';
							}
							if (ann.background) {
								colors += 'background:' + ann.background + ';';
							}

							var body = ann.title || '';

							html += '<div style="position: absolute; ' +
								'top: ' + top + 'px; ' +
								'left: ' + left + 'px; ' +
								'width: ' + width + 'px; ' +
								'height: ' + height + 'px;' + colors + '" ' +
								'class="fc-annotation fc-annotation-skin' + cls + '">' +
								body +
								'</div>';
						}
					}
				}
			}
		}
		annotationSegmentContainer[0].innerHTML = html;
	}

	function getIndexOfResource(resource) {
		var getResources = t.getResources;
		var res = getResources();
		for(var i=0; i < res.length; i++){
			if(resource == res[i].id){
				return i;
			}
		}
	}



	/* Coordinate Utilities
	-----------------------------------------------------------------------------*/


	coordinateGrid = new CoordinateGrid(function(rows, cols) {
		var e, n, p;
		dayHeadCells.each(function(i, _e) {
			e = $(_e);
			n = e.offset().left;
			if (i) {
				p[1] = n;
			}
			p = [n];
			cols[i] = p;
		});
		p[1] = n + e.outerWidth();
		if (opt('allDaySlot')) {
			e = allDayRow;
			n = e.offset().top;
			rows[0] = [n, n+e.outerHeight()];
		}
		var slotTableTop = slotContainer.offset().top;
		var slotScrollerTop = slotScroller.offset().top;
		var slotScrollerBottom = slotScrollerTop + slotScroller.outerHeight();
		function constrain(n) {
			return Math.max(slotScrollerTop, Math.min(slotScrollerBottom, n));
		}
		for (var i=0; i<slotCnt*snapRatio; i++) { // adapt slot count to increased/decreased selection slot count
			rows.push([
				constrain(slotTableTop + snapHeight*i),
				constrain(slotTableTop + snapHeight*(i+1))
			]);
		}
	});


	hoverListener = new HoverListener(coordinateGrid);

	colPositions = new HorizontalPositionCache(function(col) {
		return dayBodyCellInners.eq(col);
	});

	colContentPositions = new HorizontalPositionCache(function(col) {
		return dayBodyCellContentInners.eq(col);
	});


	function colLeft(col) {
		return colPositions.left(col);
	}


	function colContentLeft(col) {
		return colContentPositions.left(col);
	}


	function colRight(col) {
		return colPositions.right(col);
	}


	function colContentRight(col) {
		return colContentPositions.right(col);
	}


	// NOTE: the row index of these "cells" doesn't correspond to the slot index, but rather the "snap" index


	function getIsCellAllDay(cell) { // TODO: remove because mom.hasTime() from realCellToDate() is better
		return opt('allDaySlot') && !cell.row;
	}


	function realCellToDate(cell) { // ugh "real" ... but blame it on our abuse of the "cell" system
		var date = cellToDate(0, 0);  // updated
		var snapIndex = cell.row;

		if (opt('allDaySlot')) {
			snapIndex--;
		}

		if (snapIndex >= 0) {
			date.time(moment.duration(minTime + snapIndex * snapDuration));
			date = calendar.rezoneDate(date);
		}

		return date;
	}


	function computeDateTop(date, startOfDayDate) {
		return computeTimeTop(
			moment.duration(
				date.clone().stripZone() - startOfDayDate.clone().stripTime()
			)
		);
	}


	function computeTimeTop(time) { // time is a duration

		if (time < minTime) {
			return 0;
		}
		if (time >= maxTime) {
			return slotTable.height();
		}

		var slots = (time - minTime) / slotDuration;
		var slotIndex = Math.floor(slots);
		var slotPartial = slots - slotIndex;
		var slotTop = slotTopCache[slotIndex];

		// find the position of the corresponding <tr>
		// need to use this tecnhique because not all rows are rendered at same height sometimes.
		if (slotTop === undefined) {
			slotTop = slotTopCache[slotIndex] =
				slotTable.find('tr').eq(slotIndex).find('td div')[0].offsetTop;
				// .eq() is faster than ":eq()" selector
				// [0].offsetTop is faster than .position().top (do we really need this optimization?)
				// a better optimization would be to cache all these divs
		}

		var top =
			slotTop - 1 + // because first row doesn't have a top border
			slotPartial * slotHeight; // part-way through the row

		top = Math.max(top, 0);

		return top;
	}



	/* Selection
	---------------------------------------------------------------------------------*/


	function defaultSelectionEnd(start) {
		if (start.hasTime()) {
			return start.clone().add(slotDuration);
		}
		else {
			return start.clone().add(1, 'days');
		}
	}


	function renderSelection(start, end, col) {
		if (start.hasTime() || end.hasTime()) {
			renderSlotSelection(start, end); //, col);
		}
		else if (opt('allDaySlot')) {
			renderDayOverlay(start, end, true, col); // true for refreshing coordinate grid
		}
	}


	function renderSlotSelection(startDate, endDate, col) {
		var helperOption = opt('selectHelper');
		coordinateGrid.build();
		if (helperOption) {
			col = col || dateToCell(startDate).col;
			if (col >= 0 && col < colCnt) { // only works when times are on same day
				var rect = coordinateGrid.rect(0, col, 0, col, slotContainer); // only for horizontal coords
				var top = computeDateTop(startDate, startDate);
				var bottom = computeDateTop(endDate, startDate);
				if (bottom > top) { // protect against selections that are entirely before or after visible range
					rect.top = top;
					rect.height = bottom - top;
					rect.left += 2;
					rect.width -= 5;
					if ($.isFunction(helperOption)) {
						var helperRes = helperOption(startDate, endDate);
						if (helperRes) {
							rect.position = 'absolute';
							selectionHelper = $(helperRes)
								.css(rect)
								.appendTo(slotContainer);
						}
					}else{
						rect.isStart = true; // conside rect a "seg" now
						rect.isEnd = true;   //
						selectionHelper = $(slotSegHtml(
							{
								title: '',
								start: startDate,
								end: endDate,
								className: ['fc-select-helper'],
								editable: false
							},
							rect
						));
						selectionHelper.css('opacity', opt('dragOpacity'));
					}
					if (selectionHelper) {
						slotBind(selectionHelper);
						slotContainer.append(selectionHelper);
						setOuterWidth(selectionHelper, rect.width, true); // needs to be after appended
						setOuterHeight(selectionHelper, rect.height, true);
					}
				}
			}
		}else{
			renderSlotOverlay(startDate, endDate, col);
		}
	}


	function clearSelection() {
		clearOverlays();
		if (selectionHelper) {
			selectionHelper.remove();
			selectionHelper = null;
		}
	}


	function slotSelectionMousedown(ev) {
		if (ev.which == 1 && opt('selectable')) { // ev.which==1 means left mouse button
			unselect(ev);
			var dates;
			var col;
			hoverListener.start(function(cell, origCell) {
				clearSelection();
				if (cell && cell.col == origCell.col && !getIsCellAllDay(cell)) {
					col = cell.col;
					var d1 = realCellToDate(origCell);
					var d2 = realCellToDate(cell);
					dates = [
						d1,
						d1.clone().add(snapDuration), // calculate minutes depending on selection slot minutes
						d2,
						d2.clone().add(snapDuration)
					].sort(dateCompare);
					renderSlotSelection(dates[0], dates[3], cell.col);  // updated
				}else{
					dates = null;
				}
			}, ev);
			$(document).one('mouseup', function(ev) {
				hoverListener.stop();
				if (dates) {
					if (+dates[0] == +dates[1]) {
						reportDayClick(dates[0], ev);
					}
					ev.data = resources()[col]; // added
					reportSelection(dates[0], dates[3], ev);
				}
			});
		}
	}


	function reportDayClick(date, ev) {
		trigger('dayClick', dayBodyCells[dateToCell(date).col], date, ev);
	}

		/* Event Modification Reporting
	---------------------------------------------------------------------------------*/


	function eventDrop(el, event, newResources, newStart, ev, ui) {
		var mutateResult = calendar.mutateResourceEvent(event, newResources, newStart, null);

		trigger(
			'eventDrop',
			el,
			event,
			mutateResult.dateDelta,
			function() {
				mutateResult.undo();
				reportEventChange(event._id);
			},
			ev,
			ui
		);

		reportEventChange(event._id);
	}


	function eventResize(el, event, newEnd, ev, ui) {
		var mutateResult = calendar.mutateResourceEvent(event, event.resources, null, newEnd);

		trigger(
			'eventResize',
			el,
			event,
			mutateResult.durationDelta,
			function() {
				mutateResult.undo();
				reportEventChange(event._id);
			},
			ev,
			ui
		);

		reportEventChange(event._id);
	}


	/* External Dragging
	--------------------------------------------------------------------------------*/


	function dragStart(_dragElement, ev, ui) {
		hoverListener.start(function(cell) {
			clearOverlays();
			if (cell) {
				var d1 = realCellToDate(cell);
				var d2 = d1.clone();
				if (d1.hasTime()) {
					d2.add(calendar.defaultTimedEventDuration);
					renderSlotOverlay(d1, d2, cell.col);
				}
				else {
					d2.add(calendar.defaultAllDayEventDuration);
					renderDayOverlay(d1, d2, true, cell.col);
				}
			}
		}, ev);
	}


	function dragStop(_dragElement, ev, ui) {
		var cell = hoverListener.stop();
		clearOverlays();
		if (cell) {
			ev.data = resources()[cell.col];
			trigger(
				'drop',
				_dragElement,
				realCellToDate(cell),
				ev,
				ui
			);
		}
	}

	/* OVERRIDES */
	function daySelectionMousedown(ev) {
		var getIsCellAllDay = t.getIsCellAllDay;
		var hoverListener = t.getHoverListener();
		var reportDayClick = t.reportDayClick; // this is hacky and sort of weird
		var col;
		if (ev.which == 1 && opt('selectable')) { // which==1 means left mouse button
			unselect(ev);
			var dates;
			hoverListener.start(function(cell, origCell) { // TODO: maybe put cellToDate/getIsCellAllDay info in cell
				clearSelection();
				if (cell && getIsCellAllDay(cell)) {
					col = cell.col;
					dates = [ realCellToDate(origCell), realCellToDate(cell) ].sort(dateCompare);
					renderSelection(dates[0], dates[1], col);
				}else{
					dates = null;
				}
			}, ev);
			$(document).one('mouseup', function(ev) {
				hoverListener.stop();
				if (dates) {
					if (+dates[0] == +dates[1]) {
						reportDayClick(dates[0], true, ev);
					}
					ev.data = resources()[col];
					reportSelection(dates[0], dates[1], ev);
				}
			});
		}
	}

}
