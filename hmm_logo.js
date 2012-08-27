(function ($) {

  function isCanvasSupported(){
    var elem = document.createElement('canvas');
    return !!(elem.getContext && elem.getContext('2d'));
  }

  function HMMLogo(options) {
    options = (options) ? options : {};
    this.column_width = options.column_width || 34;
    this.height = options.height || 300;
    this.data = options.data || null;
    this.alphabet = options.alphabet || 'dna';
    this.dom_element = options.dom_element || $('body');
    this.start = options.start || 1;
    this.end = options.end || this.data.height_arr.length;
    this.zoom = options.zoom || 1;

    this.dna_colors = {
      'A': '#cbf751',
      'C': '#5ec0cc',
      'G': '#ffdf59',
      'T': '#b51f16',
      'U': '#b51f16'
    };

    this.aa_colors = {
      'A': '#FF9966',
      'C': '#009999',
      'D': '#FF0000',
      'E': '#CC0033',
      'F': '#00FF00',
      'G': '#f2f20c',
      'H': '#660033',
      'I': '#CC9933',
      'K': '#663300',
      'L': '#FF9933',
      'M': '#CC99CC',
      'N': '#336666',
      'P': '#0099FF',
      'Q': '#6666CC',
      'R': '#990000',
      'S': '#0000FF',
      'T': '#00FFFF',
      'V': '#FFCC33',
      'W': '#66CC66',
      'Y': '#006600'
    };

    // set the color library to use.
    this.colors = this.dna_colors;

    if (this.alphabet === 'aa') {
      this.colors = this.aa_colors;
    }

    this.canvas_width = 5000;

    this.scrollme = new EasyScroller($(this.dom_element)[0], {
      scrollingX: 1,
      scrollingY: 0
    });


    this.render = function(options) {
      if (!this.data) {
        return;
      }
      options = (options) ? options : {};
      var zoom  = options.zoom || this.zoom;
      if ( options.start ) {
        this.start = options.start;
      }
      if ( options.end ) {
        this.end = options.end;
      }

      if (zoom <= 0.1) {
        zoom = 0.1;
      }
      else if (zoom >= 1) {
        zoom = 1;
      }

      this.zoom = zoom;

      var end = this.end || this.data.height_arr.length;
      end     = (end > this.data.height_arr.length) ? this.data.height_arr.length : end;
      end     = (end < start) ? start : end;

      var start = this.start || 1;
      start     = (start > end) ? end : start;
      start     = (start > 1) ? start : 1;


      this.y = this.height - 20;

      this.zoomed_column = this.column_width * zoom;
      this.total_width = this.zoomed_column * ((end - start) + 1);

      $(this.dom_element).attr({'width':this.total_width + 'px'}).css({width:this.total_width + 'px'});

      var canvas_count = Math.ceil(this.total_width / this.canvas_width);
      this.columns_per_canvas = Math.ceil(this.canvas_width / this.zoomed_column);



      $(this.dom_element).find('canvas').remove();

      this.canvases = [];
      this.contexts = [];



      for (var i = 0; i < canvas_count; i++) {

        var split_start = (this.columns_per_canvas * i) + start;
        var split_end   = split_start + this.columns_per_canvas - 1;
        if (split_end > end) {
          split_end = end;
        }

        var adjusted_width = ((split_end - split_start) + 1) * this.zoomed_column;

        this.canvases[i] = attach_canvas(this.dom_element, this.height, adjusted_width, i);
        this.contexts[i] = this.canvases[i].getContext('2d');
        this.contexts[i].setTransform(1, 0, 0, 1, 0, 0);
        this.contexts[i].clearRect(0, 0, adjusted_width, this.height);



        if (this.zoomed_column > 12) {
          var fontsize = parseInt(10 * zoom);
          fontsize = (fontsize > 10) ? 10 : fontsize;
          this.render_with_text(split_start, split_end, i, fontsize);
        }
        else {
          this.render_with_rects(split_start, split_end, i);
        }
      }
      this.scrollme.reflow();
    }

    this.render_with_text = function(start, end, context_num, fontsize) {
      var x = 0;
      var column_num = start;
      for ( var i = start; i <=  end; i++ ) {
        var column = this.data.height_arr[i - 1];
        var previous_height = 0;
        var letters = column.length;
        for ( var j = 0; j < letters; j++ ) {
          var letter = column[j];
          var values = letter.split(':', 2);
          if (values[1] > 0.01) {
            var letter_height = (1 * values[1]) / this.data.max_height;
            var x_pos = x + (this.zoomed_column / 2);
            var y_pos = 269 - previous_height;
            var glyph_height = 258 * letter_height;

            if(!isCanvasSupported()) {
              y_pos = y_pos + (glyph_height * letter_height);
            }

            this.contexts[context_num].font = "bold 350px Arial";
            this.contexts[context_num].textAlign = "center";
            this.contexts[context_num].fillStyle = this.colors[values[0]];
            // fonts are scaled to fit into the column width
            // formula is y = 0.0024 * col_width + 0.0405
            x_scale = ((0.0024 * this.zoomed_column) + 0.0405).toFixed(2);
            this.contexts[context_num].transform (x_scale, 0, 0, letter_height, x_pos, y_pos);
            this.contexts[context_num].fillText(values[0], 0, 0);
            this.contexts[context_num].setTransform (1, 0, 0, 1, 0, 0);
            previous_height = previous_height + glyph_height;
          }
        }

        // draw column dividers
        draw_ticks(this.contexts[context_num], x, this.height - 30, 0 - this.height - 30, '#dddddd');
        // draw top ticks
        draw_ticks(this.contexts[context_num], x, 0, 5);
        //draw insert length ticks
        draw_ticks(this.contexts[context_num], x, this.height - 15, 5);
        // draw insert probability ticks
        draw_ticks(this.contexts[context_num], x, this.height - 30, 5);

        // draw column numbers
        draw_column_number(this.contexts[context_num], x, 10, this.zoomed_column, column_num, fontsize);
        draw_insert_odds(this.contexts[context_num], x, this.height, this.zoomed_column, this.data.insert_probs[i - 1] / 100, fontsize);
        draw_insert_length(this.contexts[context_num], x, this.height - 5, this.zoomed_column, this.data.insert_lengths[i - 1], fontsize);



        x += this.zoomed_column;
        column_num++;
      }
      draw_border(this.contexts[context_num], this.height - 15, this.total_width);
      draw_border(this.contexts[context_num], this.height - 30, this.total_width);
      draw_border(this.contexts[context_num], 0, this.total_width);
    }

    this.render_with_rects = function(start, end, context_num) {
      var x = 0;
      for ( var i = start; i <= end; i++ ) {
        var column = this.data.height_arr[i - 1];
        var previous_height = 0;
        var letters = column.length;
        for ( var j = 0; j < letters; j++ ) {
          var letter = column[j];
          var values = letter.split(':', 2);
          if (values[1] > 0.01) {
            var letter_height = (1 * values[1]) / this.data.max_height;
            var x_pos = x;
            var glyph_height = 277 * letter_height;
            var y_pos = 285 - previous_height - glyph_height;

            this.contexts[context_num].fillStyle = this.colors[values[0]];
            this.contexts[context_num].fillRect (x_pos, y_pos, this.zoomed_column, glyph_height);

            previous_height = previous_height + glyph_height;
          }
        }

        // draw column dividers
        draw_ticks(this.contexts[context_num], x, this.height - 15, 0 - this.height, '#dddddd');
        // draw top ticks
        draw_ticks(this.contexts[context_num], x, 0, 5);

        // draw insert probabilities/lengths
        draw_small_insert(this.contexts[context_num], x, this.height - 12, this.zoomed_column, this.data.insert_probs[i - 1] / 100, this.data.insert_lengths[i - 1]);

        x += this.zoomed_column;
      }

    }

    this.change_zoom = function(zoom_level) {
      //work out my current position
      var before_left = this.scrollme.scroller.getValues().left;

      var col_width = (this.column_width * this.zoom);
      var col_count = before_left / col_width;
      var half_visible_columns = ($('#container').width() / col_width) / 2;
      var col_total = Math.ceil(col_count + half_visible_columns);

      this.zoom = zoom_level;
      this.render({zoom: this.zoom});
      this.scrollme.reflow();

      //scroll to previous position
      this.scrollToColumn(col_total);
    }

    this.scrollToColumn = function(num, animate) {
      var half_view = ($('#container').width() / 2) - ((this.column_width * this.zoom) / 2);
      console.log(half_view);
      var new_column = num - 1;
      console.log(new_column);
      var new_left = new_column  * (this.column_width * this.zoom);
      console.log(new_left);

      this.scrollme.scroller.scrollTo(new_left - half_view, 0, animate);
    }

    function draw_small_insert(context, x, y, col_width, odds, length) {
      var fill = "#ffffff";
      if (odds > 0.4) {
        fill = '#d7301f';
      }
      else if ( odds > 0.3) {
        fill = '#fc8d59';
      }
      else if ( odds > 0.2) {
        fill = '#fdcc8a';
      }
      else if ( odds > 0.1) {
        fill = '#fef0d9';
      }
      context.fillStyle = fill;
      context.fillRect (x, y , col_width, 5);

      fill = "#ffffff";
      // draw insert length
      if (length > 99) {
        fill = '#2171b5';
      }
      else if ( length > 49) {
        fill = '#6baed6';
      }
      else if ( length > 9) {
        fill = '#bdd7e7';
      }
      context.fillStyle = fill;
      context.fillRect (x, y + 7 , col_width, 5);
    }

    function draw_border(context, y, width) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.lineWidth = 1;
      context.strokeStyle = "#999999";
      context.stroke();
    }

    function draw_insert_odds(context, x, height, col_width, text, fontsize) {
      var y        = height - 20;
      var fill     = '#ffffff';
      var textfill = '#000000';

      if (text > 0.4) {
        fill     = '#d7301f';
        textfill = '#ffffff';
      }
      else if ( text > 0.3) {
        fill = '#fc8d59';
      }
      else if ( text > 0.2) {
        fill = '#fdcc8a';
      }
      else if ( text > 0.1) {
        fill = '#fef0d9';
      }


      context.font = fontsize + "px Arial";
      context.fillStyle = fill;
      context.fillRect (x, y - 10 , col_width, 14);
      context.textAlign = "center";
      context.fillStyle = textfill;
      context.fillText(text, x + (col_width / 2), y);

      //draw vertical line to indicate where the insert would occur
      if ( text > 0.1) {
        draw_ticks(context, x + col_width, height - 30, 0 - height - 30, fill);
      }
    }

    function draw_insert_length(context, x, y, col_width, text, fontsize) {
      var fill = '#ffffff';
      var textfill = '#000000';

      if (text > 99) {
        fill     = '#2171b5';
        textfill = '#ffffff';
      }
      else if ( text > 49) {
        fill = '#6baed6';
      }
      else if ( text > 9) {
        fill = '#bdd7e7';
      }
      context.font = fontsize +"px Arial";
      context.fillStyle = fill;
      context.fillRect (x, y - 10 , col_width, 14);
      context.textAlign = "center";
      context.fillStyle = textfill;
      context.fillText(text, x + (col_width / 2), y);
    }

    function draw_column_number(context, x, y, col_width, col_num, fontsize) {
      context.font = fontsize + "px Arial";
      context.textAlign = "center";
      context.fillStyle = "#666666";
      context.fillText(col_num, x + (col_width / 2), y);
    }

    function draw_ticks(context, x, y, height, color) {
      color = (color) ? color :'#999999';
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y + height);
      context.strokeStyle = color;
      context.stroke();
    }


    function attach_canvas(DOMid, height, width, id) {
      if ($(DOMid).find('#canv_' + id).length){
        var canvas = $(DOMid).find('#canv_' + id)[0];
        $(canvas).attr('width', width)
          .attr('height',height);
        return canvas
      }
      $(DOMid).append('<canvas id="canv_' + id + '"  height="'+ height +'" width="'+ width + '"></canvas>');
      return $(DOMid).find('#canv_' + id)[0];
    }
  }

  $.fn.hmm_logo = function(options) {
    options = (options) ? options : {};
    options.dom_element = $(this);
    var zoom = options.zoom;

    var logo = new HMMLogo(options);
    logo.render(options);

    $('#zoom').bind('change', function() {
      var hmm_logo = logo;
      hmm_logo.change_zoom(this.value);
    });


    $('#position').bind('change', function() {
      var hmm_logo = logo;
      hmm_logo.scrollToColumn(this.value, 1);
    });

    $(document).keydown(function(e) {
      if(!e.ctrlKey) {
        if (e.which === 61 || e.which == 107) {
          zoom += 0.1;
          logo.change_zoom(zoom);
        }
        if (e.which === 109 || e.which == 0) {
          zoom = zoom - 0.1;
          logo.change_zoom(zoom);
        }
      }
    });

  };
})( jQuery );
