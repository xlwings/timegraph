TimeGraph = function() {

    function TimeGraph(el, charts, series) {

        this.parent = el.get(0);

        this.charts = charts;

        this.series = series;

        this.canvas = document.createElement("canvas");

        this.canvas.onmousewheel = this._onMouseWheel.bind(this);
        this.canvas.onmousedown = this._onMouseDown.bind(this);
        this.canvas.onmousemove = this._onMouseMove.bind(this);
        this.canvas.onmouseup = this._onMouseUp.bind(this);

        this.hcursor = null;

        this.options = {
            'hgridFrequency': 100
        };

        this.handlers = {
            "hcursor": []
        }

        this.mouse = {};

        el.css("overflow", "hidden");

        el.get(0).appendChild(this.canvas);

        this._hrange = this.hrange = this.calcHRange();
        this.vranges = this.calcVRanges();

        this.draw();

    };


    TimeGraph.prototype.on = function on(event, handler) {
        this.handlers[event].push(handler);
    }


    TimeGraph.prototype.emit = function emit(event) {
        var handlers = this.handlers[event];
        var args = Array.prototype.slice.call(arguments, 1);
        for(var k=0; k<handlers.length; k++) {
            handlers[k].apply(null, args);
        }
    }


    TimeGraph.prototype.LINE_COLORS = [
        "black",
        "green",
        "red",
        "blue",
        "orange",
        "purple",
        "magenta"
    ];

    function fixedTimeMarker(ms, fmt) {
        return [
            ms,
            function(start, end, callback) {
                var m = start - (start % ms) + ms;
                while(m < end) {
                    callback(m, moment.utc(m).format(fmt).toLowerCase());
                    m += ms;
                }
            }
        ];
    }

    function selectClosest(list, value, key, select) {
        if(list.length == 0)
            return null;
        var idxA = 0;
        var idxB = list.length - 1;
        var keyA = key(list[idxA]);
        if(value < keyA)
            return select(list[idxA]);
        var keyB = key(list[idxB]);
        if(value >= keyB)
            return select(list[idxB]);
        var idx;
        while(idxA+1 != idxB) {
            var idxMid = Math.floor((idxA+idxB)/2);
            var keyMid = key(list[idxMid]);
            if(value < keyMid) {
                idxB = idxMid;
                keyB = keyMid;
            }
            else {
                idxA = idxMid;
                keyA = keyMid;
            }
        }
        if(value - keyA < keyB - value) {
            return select(list[idxA]);
        } else {
            return select(list[idxB]);
        }
    }

    function weekMarker(n) {
        return [
            n*7*24*60*60*1000,
            function(start, end, callback) {
                var m = moment.utc(start).startOf('isoWeek').add(7*n, 'day');
                var end = moment.utc(end);
                while(m < end) {
                    callback(m.valueOf(), m.format("DDMMM").toLowerCase());
                    m.add(7*n, 'day');
                }
            }
        ];
    }

    function monthMarker(n) {
        return [
            n*30*24*60*60*1000,
            function(start, end, callback) {
                var m = moment.utc(start).startOf('month').add(n, 'month');
                m.month(m.month() - m.month() % n);
                var end = moment.utc(end);
                while(m < end) {
                    callback(m.valueOf(), m.month() == 0 ? m.format("YYYY") : m.format("MMM").toLowerCase());
                    m.add(n, 'month');
                }
            }
        ];
    }

    function yearMarker(n) {
        return [
            n*365*24*60*60*1000,
            function(start, end, callback) {
                var m = moment.utc(start).startOf('year').add(n, 'year');
                var end = moment.utc(end);
                while(m < end) {
                    callback(m.valueOf(), m.format("YYYY"));
                    m.add(n, 'year');
                }
            }
        ];
    }

    TimeGraph.prototype.TIME_MARKERS = [
        fixedTimeMarker(1000, ":mm:ss"),  // 1s
        fixedTimeMarker(2000, ":mm:ss"),  // 2s
        fixedTimeMarker(5000, ":mm:ss"),  // 5s
        fixedTimeMarker(10000, ":mm:ss"),  // 10s
        fixedTimeMarker(20000, ":mm:ss"),  // 20s
        fixedTimeMarker(30000, ":mm:ss"),  // 30s
        fixedTimeMarker(60000, "HH:mm"),  // 1m
        fixedTimeMarker(120000, "HH:mm"),  // 2m
        fixedTimeMarker(300000, "HH:mm"),  // 5m
        fixedTimeMarker(600000, "HH:mm"),  // 10m
        fixedTimeMarker(1200000, "HH:mm"),  // 20m
        fixedTimeMarker(1800000, "HH:mm"),  // 30m
        fixedTimeMarker(3600000, "DD HH:"),  // 1h
        fixedTimeMarker(7200000, "DD HH:"),  // 2h
        fixedTimeMarker(14400000, "DD HH:"),  // 4h
        fixedTimeMarker(28800000, "DD HH:"),  // 8h
        fixedTimeMarker(43200000, "DD HH:"),  // 12h
        fixedTimeMarker(86400000, "DD"),  // 1d
        fixedTimeMarker(172800000, "DD"),  // 2d
        // weekMarker(1),  // 1w
        //weekMarker(2),  // 2w
        fixedTimeMarker(345600000, "DDMMM"),  // 4d
        fixedTimeMarker(604800000, "DDMMM"),  // 7d
        fixedTimeMarker(1296000000, "DDMMM"),  // 15d
        monthMarker(1), // 1m
        monthMarker(2), // 2m
        monthMarker(3), // 3m
        monthMarker(6), // 6m
        yearMarker(1), // 1y
        yearMarker(2), // 2y
        yearMarker(5), // 5y
        yearMarker(10), // 10y
        yearMarker(20), // 20y
    ];

    function setCapture(el, ev, moveCallback, upCallback) {

        var start = [ev.pageX, ev.pageY];

        var moved = false;

        function mouseMove(e) {

            if(e.buttons & 1) {

                var dX = e.pageX - start[0];
                var dY = e.pageY - start[1];

                if(dX != 0 || dY != 0)
                  moved = true;

                moveCallback(dX, dY);

                e.stopPropagation();
                e.stopImmediatePropagation();
                e.preventDefault();

            } else {

                document.removeEventListener("mousemove", mouseMove, true);
                document.removeEventListener("mouseup", mouseUp, true);

                upCallback(moved);

            }

        };

        function mouseUp(e) {

            document.removeEventListener("mousemove", mouseMove, true);
            document.removeEventListener("mouseup", mouseUp, true);
            upCallback(moved);

            e.stopPropagation();
            e.stopImmediatePropagation();
            e.preventDefault();

        };

        document.addEventListener("mousemove", mouseMove, true);
        document.addEventListener("mouseup", mouseUp, true);

    }

    function strokeHLine(ctx, x, y, cx) {
        ctx.fillRect(x, y, cx, 1);
    };

    function strokeVLine(ctx, x, y, cy) {
        ctx.fillRect(x, y, 1, cy);
    };

    TimeGraph.prototype.formatNumber = function formatNumber(x, sf) {
        if(x == 0)
            return "0"
        if(typeof(sd) == 'undefined') {
            sf = 3;
        }
        var m = Math.floor(Math.log10(Math.abs(x)));
        var n = m - (((m % 3) + 3) % 3);
        var s = (Math.round(x / Math.pow(10, m-sf+1)) * Math.pow(10, m-sf+1-n)).toFixed(sf-1-m+n);
        var letter = {
            "12": 'T',
            "9": 'G',
            "6": 'M',
            "3": 'k',
            "-3": 'm',
            "-6": 'µ',
            "-9": 'n',
        }[n];
        if(letter) {
            return (x > 0 ? "+" : "") + s + letter;
        } else if(n == 0) {
            return (x > 0 ? "+" : "") + s;
        } else if(n > 100) {
            return (x > 0 ? "+∞" : "-∞");
        } else if(n < -100) {
            return "0";
        } else if(n == 0) {
            return s;
        } else {
            return (x > 0 ? "+" : "") + s + "e" + (n > 0 ? "+" : "") + n;
        }
    };


    TimeGraph.prototype.formatDate = function formatDate(t) {
        var m = moment.utc(t);
        return [
            m.format("DDMMMYY").toLowerCase(),
            m.format("HH:mm:ss")
        ];
    }

    TimeGraph.prototype.setHRange = function(hrange0, hrange1) {

        var hrange = [
            Math.max(this._hrange[0], hrange0),
            Math.min(this._hrange[1], hrange1)
        ];

        this.hrange = hrange;

        this.vranges = this.calcVRanges();
        this.draw();

    };


    TimeGraph.prototype.setHCursor = function(hcursor) {
        this.hcursor = hcursor;
        this.draw();
        this.emit("hcursor", hcursor);
    }


    TimeGraph.prototype.calcHRange = function() {

        var minTime = Number.MAX_SAFE_INTEGER;
        var maxTime = Number.MIN_SAFE_INTEGER;

        for(var k=0; k<this.charts.length; k++)
        {
            var chart = this.charts[k];
            for(var j=0; j<chart.series.length; j++)
            {
                var series = this.series[chart.series[j].id];

                if(series.times.length > 0)
                {
                    var first = series.times[0];
                    var last = series.times[series.times.length-1];
                    if(first < minTime)
                        minTime = first;
                    if(last > maxTime)
                        maxTime = last;
                }
            }
        }

        return [minTime, maxTime];

    };


    TimeGraph.prototype.calcVRanges = function() {

        var vranges = [];

        for(var k=0; k<this.charts.length; k++)
        {
            var chart = this.charts[k];

            var vrange = [
                [Number.MAX_VALUE, Number.MIN_VALUE],
                [Number.MAX_VALUE, Number.MIN_VALUE]
            ]

            for(var j=0; j<chart.series.length; j++)
            {
                var axis = chart.series[j].secondary ? 1 : 0;
                var series = this.series[chart.series[j].id];
                var idx0 = _.sortedIndex(series.times, this.hrange[0]);
                var idx1 = _.sortedIndex(series.times, this.hrange[1]);
                while(idx1 < series.times.length && series.times[idx1] == this.hrange[1])
                    idx1++;
                if(idx1 == series.times.length)
                    idx1--;
                for(var i=idx0; i<=idx1; i++)
                {
                    var x = series.values[i];
                    if(x < vrange[axis][0])
                        vrange[axis][0] = x;
                    if(x > vrange[axis][1])
                        vrange[axis][1] = x;
                }
            }

            for(var axis=0; axis<2; axis++) {
                var vmargin = 0.05 * (vrange[axis][1] - vrange[axis][0]);
                vrange[axis][0] -= vmargin;
                vrange[axis][1] += vmargin;
            }

            vranges.push(vrange);
        }

        return vranges;

    };

    TimeGraph.prototype._onMouseWheel = function(e) {

        if(e.clientX >= this.mouse.timeAxisX && e.clientX <= this.mouse.timeAxisX + this.mouse.timeAxisCX) {

            // cross-browser wheel delta
            var e = window.event || e; // old IE support
            var delta = Math.max(-1, Math.min(1, (e.wheelDelta || -e.detail)));

            var hrange = this.hrange;
            var hspan = hrange[1] - hrange[0];
            var fraction = (e.clientX - this.mouse.timeAxisX) / this.mouse.timeAxisCX;
            var hanchor = hrange[0] + hspan * fraction;
            if(delta > 0) {
                this.setHRange(
                    hanchor - fraction * 0.5 * hspan,
                    hanchor + (1.0 - fraction) * 0.5 * hspan
                );
            } else if(delta < 0) {
                this.setHRange(
                    hanchor - fraction * 2.0 * hspan,
                    hanchor + (1.0 - fraction) * 2.0 * hspan
                );
            }

        }

    };

    TimeGraph.prototype._onMouseDown = function(e) {

        if(e.clientX >= this.mouse.timeAxisX && e.clientX <= this.mouse.timeAxisX + this.mouse.timeAxisCX) {

            this.mouse.downHRange = this.hrange;

            setCapture(
                this.canvas,
                e,
                function(dX, dY) {

                    var hspan = this.mouse.downHRange[1] - this.mouse.downHRange[0];
                    var hoffset = hspan * dX / this.mouse.timeAxisCX;
                    this.setHRange(
                        this.mouse.downHRange[0] - hoffset,
                        this.mouse.downHRange[1] - hoffset
                    );

                }.bind(this),
                function(moved) {
                    if(!moved) {
                        var w = (e.clientX - this.mouse.timeAxisX) / this.mouse.timeAxisCX;
                        var hclicked = (1.0 - w) * this.mouse.downHRange[0] + w * this.mouse.downHRange[1];
                        this.setHCursor(hclicked);
                    }
                }.bind(this)
            );

        }

    };

    TimeGraph.prototype._onMouseMove = function(e) {

    };

    TimeGraph.prototype._onMouseUp = function(e) {

    };


    TimeGraph.prototype.draw = function() {

        var cx = this.canvas.width = this.parent.clientWidth;
        var cy = this.canvas.height = this.parent.clientHeight;
        var x = 0;
        var y = 0;

        var ctx = this.canvas.getContext("2d");

        ctx.font = "12px sans-serif"
        ctx.textHeight = 12;

        ctx.clearRect(x, y, cx, cy);

        this.drawCharts(ctx, x + 60, y + 30, cx - 120, cy - 60);

    };


    TimeGraph.prototype.drawCharts = function(ctx, x, y, cx, cy) {

        var self = this;
        var charts = this.charts;

        // save pixel position for mouse events
        this.mouse.timeAxisX = x;
        this.mouse.timeAxisCX = cx;

        // calculate total parts and residual space
        var totalParts = 0;
        var residualPixels = cy;
        for(var k=0; k<charts.length; k++) {
            var chart = charts[k];
            if(chart.parts > 0)
                totalParts += chart.parts;
            else
                residualPixels += chart.parts;
        }
        var pixelsPerPart = residualPixels / totalParts;

        // draw horizontal gridlines
        var mark = selectClosest(this.TIME_MARKERS, this.options.hgridFrequency, function(marker) {
            return cx * marker[0] / (self.hrange[1] - self.hrange[0]);
        }, function(marker) {
            return marker[1];
        });
        ctx.fillStyle = '#BBB';
        mark(this.hrange[0], this.hrange[1], function(t, label) {
            var xx = x + cx * (t - self.hrange[0]) / (self.hrange[1] - self.hrange[0]);
            strokeVLine(ctx, xx, y, cy);
            tw = ctx.measureText(label).width;
            ctx.fillText(label, xx - tw/2, y+cy+12);
        });

        // draw charts
        var pos = y;
        for(var k=0; k<charts.length; k++) {
            var height = charts[k].parts > 0 ? charts[k].parts * pixelsPerPart : -charts[k].parts;
            this.drawChart(k, ctx, x, pos, cx, height);
            pos += height;
        }

        // draw lines between charts
        ctx.fillStyle = '#BBB';
        var pos = y;
        strokeHLine(ctx, x-10, pos, cx+20);
        for(var k=0; k<charts.length-1; k++) {
            var height = charts[k].parts > 0 ? charts[k].parts * pixelsPerPart : -charts[k].parts;
            pos += height;
            strokeHLine(ctx, x-10, pos, cx+20);
        }
        strokeHLine(ctx, x-10, y+cy, cx+20);

        // draw rectangle around charts
        strokeVLine(ctx, x, y-10, cy+20);
        strokeVLine(ctx, x+cx, y-10, cy+20);

        // draw time axis labels
        var txt, tw;
        ctx.fillStyle = '#000'
        txt = this.formatDate(this.hrange[0]);
        tw = ctx.measureText(txt[0]).width;
        ctx.fillText(txt[0], x+2, y+cy+12);
        tw = ctx.measureText(txt[1]).width;
        ctx.fillText(txt[1], x+2, y+cy+24);
        txt = this.formatDate(this.hrange[1]);
        tw = Math.max(ctx.measureText(txt[0]).width, ctx.measureText(txt[1]).width);
        tw = ctx.measureText(txt[0]).width;
        ctx.fillText(txt[0], x+cx-tw-2, y+cy+12);
        tw = ctx.measureText(txt[1]).width;
        ctx.fillText(txt[1], x+cx-tw-2, y+cy+24);

        // draw h cursor
        if(this.hcursor && this.hrange[0] <= this.hcursor && this.hcursor <= this.hrange[1]) {
            ctx.fillStyle = '#FC0';
            strokeVLine(ctx, x + cx * (this.hcursor - this.hrange[0]) / (this.hrange[1] - this.hrange[0]), y, cy);
        }
    };


    TimeGraph.prototype.drawChart = function(iChart, ctx, x, y, cx, cy) {

        var chart = this.charts[iChart];
        var hrange = this.hrange;
        var vranges = this.vranges[iChart];

        var hoffset = hrange[0];
        var hspan = hrange[1] - hrange[0];

        // draw axis labels
        ctx.fillStyle = "#000"

        var txt, tw;

        for(var axis=0; axis<2; axis++) {
            var vrange = vranges[axis];
            if(vrange[1] > vrange[0]) {

                txt = this.formatNumber(vrange[1]);
                tw = ctx.measureText(txt).width;

                if(axis == 0)
                    ctx.fillText(txt, x-tw-2, y+ctx.textHeight);
                else
                    ctx.fillText(txt, x+cx+2, y+ctx.textHeight);

                txt = this.formatNumber(vrange[0]);
                tw = ctx.measureText(txt).width;
                if(axis == 0)
                    ctx.fillText(txt, x-tw-2, y+cy-2);
                else
                    ctx.fillText(txt, x+cx+2, y+cy-2);

                /*if(vrange[0] < 0 && vrange[1] > 0) {
                    var my_gradient=ctx.createLinearGradient(0,0,cx,0);
                    my_gradient.addColorStop(0,"#888");
                    my_gradient.addColorStop(1,"#FFF");
                    ctx.fillStyle=my_gradient;
                    strokeHLine(
                        ctx,
                        x,
                        y + cy * (1.0 + voffset / vspan),
                        cx
                    )
                }*/

            }
        }

        // draw lines
        ctx.save();
        ctx.rect(x, y, cx, cy);
        ctx.clip();
        for(var j=0; j<chart.series.length; j++) {

            var axis = chart.series[j].secondary ? 1 : 0;

            var vrange = vranges[axis];
            var voffset = vrange[0];
            var vspan = vrange[1] - vrange[0];

            var series = this.series[chart.series[j].id];

            var dotStyle = chart.series[j].dot || "";
            var lineStyle = chart.series[j].line || "/";

            if(series.times.length >= 2) {

                var pathBegun = false;
                ctx.strokeStyle = this.LINE_COLORS[j % this.LINE_COLORS.length];

                var idx0 = _.sortedIndex(series.times, this.hrange[0]);
                while(idx0 >= 0 && series.times[idx0] > this.hrange[0])
                    idx0--;
                var idx1 = _.sortedIndex(series.times, this.hrange[1]);
                while(idx1 < series.times.length && series.times[idx1] == this.hrange[1])
                    idx1++;
                if(idx1 == series.times.length)
                    idx1--;
    
                var prevX, prevY = NaN;
                var X = 0, Y = NaN;
                var pxX, pxY, pxPrevX, pxPrevY;
                for(var i=idx0; i<=idx1; i++) {

                    prevX = X;
                    prevY = Y;
                    pxPrevX = pxX;
                    pxPrevY = pxY;

                    X = series.times[i];
                    Y = series.values[i];

                    if(!isNaN(Y)) {

                        pxX = x + cx * (X - hoffset) / hspan;
                        pxY = y + cy * (1.0 - (Y - voffset) / vspan);

                        if(!isNaN(prevY)) {

                            //pxPrevX = x + cx * (prevX - hoffset) / hspan;
                            //pxPrevY = y + cy * (1.0 - (prevY - voffset) / vspan);

                            ctx.beginPath();
                            ctx.moveTo(
                                pxPrevX,
                                pxPrevY
                            );
                            if(lineStyle == "/") {
                                ctx.lineTo(
                                    pxX,
                                    pxY
                                );
                            }
                            else if(lineStyle == "_|") {
                                ctx.lineTo(
                                    pxX,
                                    pxPrevY
                                );
                                ctx.lineTo(
                                    pxX,
                                    pxY
                                );
                            }
                            else if(lineStyle == "_") {
                                ctx.lineTo(
                                    pxX,
                                    pxPrevY
                                );
                            }
                            ctx.stroke();

                        }

                        if(dotStyle == '.')
                            ctx.fillRect(pxX-1, pxY-1, 3, 3);

                    }
                }

            }
        }
        ctx.restore();

        // draw series labels
        var pos = y;
        var pos2 = y;
        for(var j=0; j<chart.series.length; j++) {
            var series = chart.series[j];
            ctx.strokeStyle = "#FFF"
            ctx.fillStyle = this.LINE_COLORS[j % this.LINE_COLORS.length];
            if(!series.secondary) {
                pos += ctx.textHeight;
                ctx.strokeText(series.label, x+2, pos);
                ctx.fillText(series.label, x+2, pos);
            } else {
                pos2 += ctx.textHeight;
                tw = ctx.measureText(series.label).width;
                ctx.strokeText(series.label, x+cx-tw-2, pos2);
                ctx.fillText(series.label, x+cx-tw-2, pos2);
            }
        }

    };

    return TimeGraph;

}();
