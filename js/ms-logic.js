(function(cfg) {
	function toRange(x, max, min) {
		return Math.max(Math.min(max, x), min);
	}
	function getQueryString(name) {
		var reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)", "i");
		var r = window.location.search.substr(1).match(reg);
		if (r != null) return unescape(r[2]); return null;
    }
    var w = toRange(parseInt(getQueryString('w') || 30), 30, 8);
    var h = toRange(parseInt(getQueryString('h') || 16), 24, 8);
    var mines = toRange(parseInt(getQueryString('mines') || 99), parseInt(w * h / 2), 10);
    console.log(w, h, mines);

	var field = createField(w, h, '#field-canvas');
	createBorder('div.main');
	var game = new MSGame(w, h, mines, field);

	cfg.restart.addEventListener('click', function() {
		game.restart();
	});

	function MSGame(w, h, totalMines, field) {
		var stopped = false;
		var uncoveredCnt = 0;
		var notifyId = null;

		field.onReady(function() {
			reset();
			// createDialog('#field-canvas', '');
		});
		field.onRight(function(center) {
			if(stopped || !center) return;
			if(!center.covered) {
				return;
			}
			if(center.flagged) {
				center.unflag();
				field.setMineCnt(1);
			} else {
				center.flag();
				field.setMineCnt(-1);
			}
		});
		field.onLeft(function(cell, points) {
			if(stopped || !cell || cell.flagged) return;
			if(points.length > 1) {
				if(cell.covered) return;
				if(getAdj(cell).filter(function(e){return e.flagged;}).length === cell.content){
					expand(points.map(function(pos){
						return field.matrix[pos[0]][pos[1]];
					}));
				}
			} else if(cell.covered) {
				expand(cell);
			}
		});

		function expand(cell) {
			if(field.startTime < 0) {
				initialize(cell);
			}

			var toUncover;
			if(cell instanceof Array) {
				toUncover = cell.map(function(e){return [e, -200]});
			} else {
				toUncover = [[cell, -200]];
			}
			// dfs search
			while(toUncover.length > 0) {
				var e = toUncover.shift();
				var cx = e[0], tx = e[1];
				if(!cx.covered) continue;
				cx.uncover(tx);
				uncoveredCnt ++;

				if(cx.content === 0) {
					getAdj(cx).forEach(function(adj) {
						if(!adj.covered || adj.flagged) return;
						toUncover.push([adj, tx + 40]);
					});
				} else if (cx.content === 'mine') {
					cx.mine(true);
					bombAll(cx);
					return;
				}
			}
			if(uncoveredCnt >= w * h - totalMines) {
				win();
			}
		}
		function bombAll(ex) {
			field.stopTime();
			stopped = true;
			ex.bomb();
			var maxDist = 0;
			for (var row = 0; row < h; row++) {
				for (var col = 0; col < w; col++) {
					var e = field.matrix[row][col];
					if(e.content === 'mine') {
						e.uncover();
						var d = 800 + dist(e, ex) * 200;
						maxDist = Math.max(d, maxDist);
						e.bomb(d);
					}
				}
			}
			notifyId = setTimeout(function() {
				if(stopped) {
					showFailedDialog();
				}
			}, maxDist + 2100);
			function dist(e1, e2) {
				var dr = e1.row - e2.row, dc = e1.col - e2.col;
				return Math.sqrt(dr * dr + dc * dc);
			}
		}
		function win() {
			field.stopTime();
			field.startScan();
			stopped = true;
			for (var row = 0; row < h; row++) {
				for (var col = 0; col < w; col++) {
					var e = field.matrix[row][col];
					if(e.content === 'mine') {
						e.shine((h - row) * 170);
					}
				}
			}
			notifyId = setTimeout(function() {
				if(stopped) {
					showWinDialog();
				}
			}, 2000 + h * 200);
		}
		function getAdj(cell) {
			var row = cell.row, col = cell.col;
			var adjs = [];
			if(row > 0) {
				if(col > 0) {
					adjs.push(field.matrix[row - 1][col - 1]);
				}
				if(col < w - 1) {
					adjs.push(field.matrix[row - 1][col + 1]);
				}
				adjs.push(field.matrix[row - 1][col]);
			}
			if(col > 0) {
				adjs.push(field.matrix[row][col - 1]);
			}
			if(col < w - 1) {
				adjs.push(field.matrix[row][col + 1]);
			}
			if(row < h - 1) {
				if(col > 0) {
					adjs.push(field.matrix[row + 1][col - 1]);
				}
				if(col < w - 1) {
					adjs.push(field.matrix[row + 1][col + 1]);
				}
				adjs.push(field.matrix[row + 1][col]);
			}
			return adjs;
		}
		function initialize(cell) {
			field.resetTime(0);
			var startRow = cell.row, startCol = cell.col;

			// generate mines
			var cells = [];
			for (var row = 0; row < h; row++) {
				for (var col = 0; col < w; col++) {
					if(Math.abs(row - startRow) <= 1 && Math.abs(col - startCol) <= 1) continue;
					cells.push(field.matrix[row][col]);
				}
			}
			// suffle
			for(var i = 0; i < cells.length; i++) {
				var j = parseInt(Math.random() * cells.length);
				if(j != i) {
					var tmp;
					tmp = cells[i];
					cells[i] = cells[j];
					cells[j] = tmp;
				}
			}
			// set mine
			for(i = 0; i < totalMines; i++) {
				cells.pop().mine();
			}

			// statistic mines around
			for (row = 0; row < h; row++) {
				for (col = 0; col < w; col++) {
					var cnt = 0;
					var c = field.matrix[row][col];
					if(c.content === 'mine') continue;
					c.number(getAdj(c).filter(function(e){ return e.content === 'mine'; }).length);
				}
			}
		}
		function reset() {
			field.resetContent();
			field.resetTime(-Infinity);
			field.initAnim();
			field.setMineCnt(0, totalMines);
			stopped = false;
			uncoveredCnt = 0;
			if(notifyId) {
				clearInterval(notifyId);
				notifyId = null;
			}
		}
		Object.defineProperty(this, 'reset', {value : reset});
	}
	MSGame.prototype.restart = function() {
		this.reset();
	};

	cfg.exit.addEventListener('click', function() {
		if(confirm('Tired of Mine Swepper?')) {
			return location.href = 'about:blank';
		}
	});
    function showDialog(sourceContent, setter) {
        var dialog = document.querySelector('div#dialog');
        var contentDiv = document.querySelector('div#dialog-content');
        var content = document.querySelector(sourceContent);
        contentDiv.innerHTML = content.innerHTML.replace(/(<!--)|(-->)/g, "");

        dialog.style.opacity = 1;
        dialog.style['pointer-events'] = 'auto';
        var src = document.querySelector('#field-canvas');
        src.style['pointer-events'] = 'none';

        var canvas = document.querySelector('#blur-bg');
        canvas.width = 320; canvas.height = 240;
        canvas.getContext('2d').drawImage(src, (src.width - 320) / 2, (src.height - 240) / 2 + 2, 320, 240, 0, 0, 320, 240);
        if(typeof setter === 'function') setter(contentDiv);
    }
    function closeDialog() {
        var src = document.querySelector('#field-canvas');
        var dialog = document.querySelector('div#dialog');
        dialog.style.opacity = 0;
        dialog.style['pointer-events'] = 'none';
        src.style['pointer-events'] = 'auto';
    }
    function isDialogShowing() {
        return document.querySelector('div#dialog').style.opacity == 1;
    }

	cfg.settings.addEventListener('click', function() {
        if (isDialogShowing()) {
            closeDialog();
        } else {
            showDialog('div#dialog-content-settings', function(element){
                element.querySelector('#width').value = w;
                element.querySelector('#height').value = h;
                element.querySelector('#mines').value = mines;

                element.querySelector('#settings-ok').addEventListener('click', function(){
                    var w = parseInt(document.querySelector('#width').value);
                    var h = parseInt(document.querySelector('#height').value);
                    var mines = parseInt(document.querySelector('#mines').value);
                    close();
                    setTimeout(function(){
                        location.href = location.origin + location.pathname + '?w=' + w + '&h=' + h + '&mines=' + mines;
                    }, 200);
                });
            });
        }
	});

    function showWinDialog() {
        if (isDialogShowing()) {
            closeDialog();
        }
        showDialog('div#dialog-content-result', function(element) {
            var text = [
                'Congratulations! You Win!',
                'You spent ' + field.getCurrentTime() + 's on the game',
                'it\'s amazing!'
            ];
            element.querySelector('#result-text').innerHTML = text.join('\n');
            element.querySelector('#result-close').addEventListener('click', function(element) {
                closeDialog();
            });
        });
    }

    function showFailedDialog() {
        if (isDialogShowing()) {
            closeDialog();
        }
        showDialog('div#dialog-content-result', function(element) {
            var text = [
                'Ooh sorry! You failed...',
                'You spent ' + field.getCurrentTime() + 's on the game',
                'What a pity!'
            ];
            element.querySelector('#result-text').innerHTML = text.join('\n');
            element.querySelector('#result-close').addEventListener('click', function(element) {
                closeDialog();
            });
        });
    }

	document.addEventListener('contextmenu', function(e) {
		e.preventDefault();
		e.stopPropagation();
	});
})(window.mscfg);
