/*jslint browser:true */
/*global G_vmlCanvasManager, EasyScroller */
/** @license
 * HMM logo
 * http://github.com/url/here
 * Copyright 2013, Jody Clements.
 * Licensed under the MIT License.
 * http://url/to/license
 */

(function ($) {
  "use strict";

  // checking for canvas support and caching result
  var canv_support = null;
  function canvasSupport() {
    if (!canv_support) {
      var elem = document.createElement('canvas');
      canv_support = !!(elem.getContext && elem.getContext('2d'));
    }
    return canv_support;
  }

  function Letter(letter, options) {
    options = options || {};
    this.value = letter;
    this.width = parseInt(options.width, 10) || 100;

    //W is 30% wider than the other letters, so need to make sure
    //it gets modified accordingly.
    if (this.value === 'W') {
      this.width += (this.width * 30) / 100;
    }

    this.height = parseInt(options.height, 10) || 100;

    this.color = options.color || '#000000';
    // if the height and width are changed from the default, then
    // this will also need to be changed as it cant be calculated
    // dynamically.
    this.fontSize = options.fontSize || 138;

    this.scaled = function () { };

    this.draw = function (ext_ctx, target_height, target_width, x, y) {
      var h_ratio = target_height / this.height,
        w_ratio = target_width / this.width,
        prev_font = ext_ctx.font;
      ext_ctx.transform(w_ratio, 0, 0, h_ratio, x, y);
      ext_ctx.fillStyle = this.color;
      ext_ctx.textAlign = "center";
      ext_ctx.font = "bold " + this.fontSize + "px Arial";

      ext_ctx.fillText(this.value, 0, 0);
      //restore the canvas settings
      ext_ctx.setTransform(1, 0, 0, 1, 0, 0);
      ext_ctx.fillStyle = '#000000';
      ext_ctx.font = prev_font;
    };

  }

  function HMMLogo(options) {
    options = options || {};

    this.column_width = options.column_width || 34;
    this.height = options.height || 300;
    this.data = options.data || null;
    this.debug = options.debug || null;
    this.scale_height_enabled = options.height_toggle || null;
    if (options.zoom_buttons && options.zoom_buttons === 'disabled') {
      this.zoom_enabled = null;
    } else {
      this.zoom_enabled = true;
    }

    // never show the alignment coordinates by default as that would get
    // really confusing.
    this.display_ali_map = 0;

    this.alphabet = options.data.alphabet || 'dna';
    this.dom_element = options.dom_element || $('body');
    this.called_on = options.called_on || null;
    this.start = options.start || 1;
    this.end = options.end || this.data.height_arr.length;
    this.zoom = parseFloat(options.zoom) || 0.4;
    this.default_zoom = this.zoom;

    if (options.scaled_max) {
      this.data.max_height = options.data.max_height_obs || this.data.max_height || 2;
    } else {
      this.data.max_height = options.data.max_height_theory || this.data.max_height || 2;
    }


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

    //build the letter canvases
    this.letters = {};
    var letter = null;

    for (letter in this.colors) {
      var loptions = {color: this.colors[letter]};
      this.letters[letter] = new Letter(letter, loptions);
    }

    // this needs to be set to null here so that we can initialise it after
    // the render function has fired and the width determined.
    this.scrollme = null;

    this.previous_target = 0;
    // keeps track of which canvas elements have been drawn and which ones haven't.
    this.rendered = [];
    this.previous_zoom = 0;

    function draw_small_insert(context, x, y, col_width, in_odds, in_length, del_odds) {
      var fill = "#ffffff";
      if (in_odds > 0.1) {
        fill = '#d7301f';
      } else if (in_odds > 0.05) {
        fill = '#fc8d59';
      } else if (in_odds > 0.03) {
        fill = '#fdcc8a';
      }
      context.fillStyle = fill;
      context.fillRect(x, y + 15, col_width, 10);

      fill = "#ffffff";
      // draw insert length
      if (in_length > 9) {
        fill = '#d7301f';
      } else if (in_length > 7) {
        fill = '#fc8d59';
      } else if (in_length > 4) {
        fill = '#fdcc8a';
      }
      context.fillStyle = fill;
      context.fillRect(x, y + 30, col_width, 10);

      fill = "#ffffff";
      // draw delete odds
      if (del_odds < 0.75) {
        fill = '#2171b5';
      } else if (del_odds < 0.85) {
        fill = '#6baed6';
      } else if (del_odds < 0.95) {
        fill = '#bdd7e7';
      }
      context.fillStyle = fill;
      context.fillRect(x, y, col_width, 10);
    }

    function draw_border(context, y, width) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(width, y);
      context.lineWidth = 1;
      context.strokeStyle = "#999999";
      context.stroke();
    }

    function draw_ticks(context, x, y, height, color) {
      color = color || '#999999';
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(x, y + height);
      context.lineWidth = 1;
      context.strokeStyle = color;
      context.stroke();
    }

    function draw_rect_with_text(context, x, y, text, fontsize, col_width, fill, textfill) {
      context.font = fontsize + "px Arial";
      context.fillStyle = fill;
      context.fillRect(x, y - 10, col_width, 14);
      context.textAlign = "center";
      context.fillStyle = textfill;
      context.fillText(text, x + (col_width / 2), y);
    }

    function draw_insert_odds(context, x, height, col_width, text, fontsize) {
      var y        = height - 20,
        fill     = '#ffffff',
        textfill = '#555555';

      if (text > 0.1) {
        fill     = '#d7301f';
        textfill = '#ffffff';
      } else if (text > 0.05) {
        fill = '#fc8d59';
      } else if (text > 0.03) {
        fill = '#fdcc8a';
      }

      draw_rect_with_text(context, x, y, text, fontsize, col_width, fill, textfill);

      //draw vertical line to indicate where the insert would occur
      if (text > 0.03) {
        draw_ticks(context, x + col_width, height - 30, -30 - height, fill);
      }
    }

    function draw_insert_length(context, x, y, col_width, text, fontsize) {
      var fill = '#ffffff',
        textfill = '#555555';

      if (text > 9) {
        fill     = '#d7301f';
        textfill = '#ffffff';
      } else if (text > 7) {
        fill = '#fc8d59';
      } else if (text > 4) {
        fill = '#fdcc8a';
      }
      draw_rect_with_text(context, x, y, text, fontsize, col_width, fill, textfill);
    }

    function draw_delete_odds(context, x, height, col_width, text, fontsize) {
      var y        = height - 35,
        fill     = '#ffffff',
        textfill = '#555555';

      if (text < 0.75) {
        fill     = '#2171b5';
        textfill = '#ffffff';
      } else if (text < 0.85) {
        fill = '#6baed6';
      } else if (text < 0.95) {
        fill = '#bdd7e7';
      }

      draw_rect_with_text(context, x, y, text, fontsize, col_width, fill, textfill);
    }


    function draw_column_number(context, x, y, col_width, col_num, fontsize, right) {
      context.font = fontsize + "px Arial";
      context.textAlign = right ? "right" : "center";
      context.fillStyle = "#666666";
      context.fillText(col_num, x + (col_width / 2), y);
    }


    function attach_canvas(DOMid, height, width, id, canv_width) {
      var canvas = $(DOMid).find('#canv_' + id);

      if (!canvas.length) {
        $(DOMid).append('<canvas class="canvas_logo" id="canv_' + id + '"  height="' + height + '" width="' + width + '" style="left:' + canv_width * id + 'px"></canvas>');
        canvas = $(DOMid).find('#canv_' + id);
      }

      $(canvas).attr('width', width).attr('height', height);

      if (!canvasSupport()) {
        canvas[0] = G_vmlCanvasManager.initElement(canvas[0]);
      }

      return canvas[0];
    }

    // the main render function that draws the logo based on the provided options.
    this.render = function (options) {
      if (!this.data) {
        return;
      }
      options    = options || {};
      var zoom   = options.zoom || this.zoom,
        target = options.target || 1,
        scaled = options.scaled || null,
        parent_width = $(this.dom_element).parent().width(),
        max_canvas_width = 1,
        i = 0;

      if (target === this.previous_target) {
        return;
      }

      this.previous_target = target;


      if (options.start) {
        this.start = options.start;
      }
      if (options.end) {
        this.end = options.end;
      }

      if (zoom <= 0.1) {
        zoom = 0.1;
      } else if (zoom >= 1) {
        zoom = 1;
      }

      this.zoom = zoom;

      var end = this.end || this.data.height_arr.length;
      var start = this.start || 1;
      end     = (end > this.data.height_arr.length) ? this.data.height_arr.length : end;
      end     = (end < start) ? start : end;

      start     = (start > end) ? end : start;
      start     = (start > 1) ? start : 1;

      this.y = this.height - 20;
      // Check to see if the logo will fit on the screen at full zoom.
      this.max_width = this.column_width * ((end - start) + 1);
      // If it fits then zoom out and disable zooming.
      if (parent_width > this.max_width) {
        zoom = 1;
        this.zoom_enabled = false;
      }
      this.zoom = zoom;

      this.zoomed_column = this.column_width * zoom;
      this.total_width = this.zoomed_column * ((end - start) + 1);

      // If zoom is not maxed and we still aren't filling the window
      // then ramp up the zoom level until it fits, then disable zooming.
      // Then we get a decent logo with out needing to zoom in or out.
      if (zoom < 1) {
        while (this.total_width < parent_width) {
          this.zoom += 0.1;
          this.zoomed_column = this.column_width * this.zoom;
          this.total_width = this.zoomed_column * ((end - start) + 1);
          this.zoom_enabled = false;
          if (zoom >= 1) {
            break;
          }
        }
      }

      if (target > this.total_width) {
        target = this.total_width;
      }
      $(this.dom_element).attr({'width': this.total_width + 'px'}).css({width: this.total_width + 'px'});

      var canvas_count = Math.ceil(this.total_width / this.canvas_width);
      this.columns_per_canvas = Math.ceil(this.canvas_width / this.zoomed_column);


      if (this.previous_zoom !== this.zoom) {
        $(this.dom_element).find('canvas').remove();
        this.previous_zoom = this.zoom;
        this.rendered = [];
      }

      this.canvases = [];
      this.contexts = [];


      for (i = 0; i < canvas_count; i++) {

        var split_start = (this.columns_per_canvas * i) + start,
          split_end   = split_start + this.columns_per_canvas - 1;
        if (split_end > end) {
          split_end = end;
        }

        var adjusted_width = ((split_end - split_start) + 1) * this.zoomed_column;

        if (adjusted_width > max_canvas_width) {
          max_canvas_width = adjusted_width;
        }

        var canv_start = max_canvas_width * i,
          canv_end = canv_start + adjusted_width;

        if (target < canv_end + (canv_end / 2) && target > canv_start - (canv_start / 2)) {
          // Check that we aren't redrawing the canvas and if not, then attach it and draw.
          if (this.rendered[i] !== 1) {

            this.canvases[i] = attach_canvas(this.dom_element, this.height, adjusted_width, i, max_canvas_width);
            this.contexts[i] = this.canvases[i].getContext('2d');
            this.contexts[i].setTransform(1, 0, 0, 1, 0, 0);
            this.contexts[i].clearRect(0, 0, adjusted_width, this.height);
            this.contexts[i].fillStyle = "#ffffff";
            this.contexts[i].fillRect(0, 0, canv_end, this.height);


            if (this.zoomed_column > 12) {
              var fontsize = parseInt(10 * zoom, 10);
              fontsize = (fontsize > 10) ? 10 : fontsize;
              if (this.debug) {
                this.render_with_rects(split_start, split_end, i, 1);
              }
              this.render_with_text(split_start, split_end, i, fontsize);
            } else {
              this.render_with_rects(split_start, split_end, i);
            }
            this.rendered[i] = 1;
          }
        }

      }

      // check if the scroller object has been initialised and if not then do so.
      // we do this here as opposed to at object creation, because we need to
      // make sure the logo has been rendered and the width is correct, otherwise
      // we get a weird initial state where the canvas will bounce back to the
      // beginning the first time it is scrolled, because it thinks it has a
      // width of 0.
      if (!this.scrollme) {
        if (canvasSupport()) {
          this.scrollme = new EasyScroller($(this.dom_element)[0], {
            scrollingX: 1,
            scrollingY: 0,
            eventTarget: this.called_on
          });
        }
      }

      if (target !== 1 && canvasSupport()) {
        this.scrollme.reflow();
      }
      return;
    };

    this.render_x_axis_label = function () {
      var label = "Model Position";
      if (this.display_ali_map) {
        label = "Alignment Column";
      }
      $(this.called_on).find('.logo_xaxis').remove();
      $(this.called_on).prepend('<div class="logo_xaxis" class="centered" style="margin-left:40px"><p class="xaxis_text" style="width:10em;margin:1em auto">' + label + '</p></div>');
    };

    this.render_y_axis_label = function () {
      //attach a canvas for the y-axis
      $(this.dom_element).parent().before('<canvas class="logo_yaxis" height="300" width="55"></canvas>');
      var canvas = $(this.called_on).find('.logo_yaxis'),
        top_pix_height = 0,
        bottom_pix_height = 0,
        top_height = Math.abs(this.data.max_height),
        bottom_height = (isNaN(this.data.min_height_obs)) ? 0 : parseInt(this.data.min_height_obs, 10);
      if (!canvasSupport()) {
        canvas[0] = G_vmlCanvasManager.initElement(canvas[0]);
      }
      var context = canvas[0].getContext('2d'),
        axis_label = "Information Content (bits)";
      //draw min/max tick marks
      context.beginPath();
      context.moveTo(55, 1);
      context.lineTo(40, 1);

      context.moveTo(55, 256);
      context.lineTo(40, 256);


      context.moveTo(55, (256 / 2));
      context.lineTo(40, (256 / 2));
      context.lineWidth = 1;
      context.strokeStyle = "#666666";
      context.stroke();

      //draw the label text
      context.fillStyle = "#666666";
      context.textAlign = "right";
      context.font = "bold 10px Arial";

      // draw the max label
      context.textBaseline = "top";
      context.fillText(parseFloat(this.data.max_height).toFixed(1), 38, 0);
      context.textBaseline = "middle";

      // draw the midpoint labels
      context.fillText(parseFloat(this.data.max_height / 2).toFixed(1), 38, (256 / 2));
      // draw the min label
      context.fillText('0', 38, 256);

      // draw the axis label
      if (this.data.height_calc === 'score') {
        axis_label = "Score (bits)";
      }

      context.save();
      context.translate(5, this.height / 2 - 20);
      context.rotate(-Math.PI / 2);
      context.textAlign = "center";
      context.font = "normal 12px Arial";
      context.fillText(axis_label, 1, 0);
      context.restore();

      // draw the insert row labels
      context.fillText('occupancy', 55, 263);
      context.fillText('ins. prob.', 50, 280);
      context.fillText('ins. len.', 46, 296);
    };

    this.render_x_axis_label();
    this.render_y_axis_label();

    this.render_with_text = function (start, end, context_num, fontsize) {
      var x = 0,
        column_num = start,
        column_label = null,
        i = 0,
        top_height = Math.abs(this.data.max_height),
        bottom_height = (isNaN(this.data.min_height_obs)) ? 0 : parseInt(this.data.min_height_obs, 10),
        total_height = top_height + Math.abs(bottom_height),
        top_percentage    = Math.round((Math.abs(this.data.max_height) * 100) / total_height),
        //convert % to pixels
        top_pix_height = Math.round((256 * top_percentage) / 100),
        bottom_pix_height = 256 - top_pix_height,
        // this is used to transform the 256px high letters into the correct size
        // when displaying negative values, so that they fit above the 0 line.
        top_pix_conversion = top_pix_height / 256,
        bottom_pix_conversion = bottom_pix_height / 256;

      // add 3 extra columns so that numbers don't get clipped at the end of a canvas
      // that ends before a large column. DF0000830 was suffering at zoom level 0.6,
      // column 2215. This adds a little extra overhead, but is the easiest fix for now.
      if (end + 3 <= this.end) {
        end += 3;
      }

      for (i = start; i <= end; i++) {
        if (this.data.mmline && this.data.mmline[i - 1] === 1) {
          this.contexts[context_num].fillStyle = '#cccccc';
          this.contexts[context_num].fillRect(x, 10, this.zoomed_column, this.height - 40);
        } else {
          var column = this.data.height_arr[i - 1],
            col_positions = [];
          if (column) {
            var previous_height = 0,
              letters = column.length,
              previous_neg_height = top_pix_height,
              j = 0;
            for (j = 0; j < letters; j++) {
              var letter = column[j],
                values = letter.split(':', 2),
                x_pos = x + (this.zoomed_column / 2),
                letter_height = null;

              // we don't render anything with a value between 0 and 0.01. These
              // letters would be too small to be meaningful on any scale, so we
              // just squash them out.
              if (values[1] > 0.01) {
                letter_height = parseFloat(values[1]) / this.data.max_height;
                var y_pos = 255 - previous_height;
                var glyph_height = 255 * letter_height;

                // The positioning in IE is off, so we need to modify the y_pos when
                // canvas is not supported and we are using VML instead.
                if (!canvasSupport()) {
                  y_pos = y_pos + (glyph_height * (letter_height / 2));
                }

                col_positions[j] = [glyph_height, this.zoomed_column, x_pos, y_pos];
                previous_height = previous_height + glyph_height;
              }
            }

            // render the letters in reverse order so that the larger letters on the top
            // don't clobber the smaller letters below them.
            for (j = letters; j >= 0; j--) {
              if (col_positions[j] && this.letters[column[j][0]]) {
                this.letters[column[j][0]].draw(this.contexts[context_num], col_positions[j][0], col_positions[j][1], col_positions[j][2], col_positions[j][3]);
              }
            }
          }
        }

        //draw insert length ticks
        draw_ticks(this.contexts[context_num], x, this.height - 15, 5);
        // draw insert probability ticks
        draw_ticks(this.contexts[context_num], x, this.height - 30, 5);
        // draw delete probability ticks
        draw_ticks(this.contexts[context_num], x, this.height - 45, 5);

        // if ali_coordinates exist and toggle is set then display the
        // alignment coordinates and not the model coordinates.
        if (this.display_ali_map) {
          column_label = this.data.ali_map[i - 1];
        } else {
          column_label = column_num;
        }

        if (this.zoom < 0.7) {
          if (i % 5 === 0) {
            this.draw_column_divider({
              context_num : context_num,
              x : x,
              fontsize: 10,
              column_num: column_label,
              ralign: true
            });
          }
        } else {
          this.draw_column_divider({
            context_num : context_num,
            x : x,
            fontsize: fontsize,
            column_num: column_label
          });
        }

        draw_delete_odds(this.contexts[context_num], x, this.height, this.zoomed_column, this.data.delete_probs[i - 1], fontsize);
        draw_insert_odds(this.contexts[context_num], x, this.height, this.zoomed_column, this.data.insert_probs[i - 1], fontsize);
        draw_insert_length(this.contexts[context_num], x, this.height - 5, this.zoomed_column, this.data.insert_lengths[i - 1], fontsize);

        x += this.zoomed_column;
        column_num++;
      }


      // draw other dividers
      draw_border(this.contexts[context_num], this.height - 15, this.total_width);
      draw_border(this.contexts[context_num], this.height - 30, this.total_width);
      draw_border(this.contexts[context_num], this.height - 45, this.total_width);
      draw_border(this.contexts[context_num], 0, this.total_width);
    };

    this.draw_column_divider = function (opts) {
      var div_x = opts.ralign ? opts.x + this.zoomed_column : opts.x,
        num_x = opts.ralign ? opts.x + 2 : opts.x;
      // draw column dividers
      draw_ticks(this.contexts[opts.context_num], div_x, this.height - 30, -30 - this.height, '#dddddd');
      // draw top ticks
      draw_ticks(this.contexts[opts.context_num], div_x, 0, 5);
      // draw column numbers
      draw_column_number(this.contexts[opts.context_num], num_x, 10, this.zoomed_column, opts.column_num, opts.fontsize, opts.ralign);
    };

    this.render_with_rects = function (start, end, context_num, borders) {
      var x = 0,
        column_num = start,
        column_label = null,
        i = 0,
        top_height = Math.abs(this.data.max_height),
        bottom_height = Math.abs(this.data.min_height_obs),
        total_height = top_height + bottom_height,
        top_percentage    = Math.round((Math.abs(this.data.max_height) * 100) / total_height),
        //convert % to pixels
        top_pix_height = Math.round((256 * top_percentage) / 100),
        bottom_pix_height = 256 - top_pix_height,
        mod = 10;

      for (i = start; i <= end; i++) {
        if (this.data.mmline && this.data.mmline[i - 1] === 1) {
          this.contexts[context_num].fillStyle = '#cccccc';
          this.contexts[context_num].fillRect(x, 10, this.zoomed_column, this.height - 40);
        } else {
          var column = this.data.height_arr[i - 1],
            previous_height = 0,
            previous_neg_height = top_pix_height,
            letters = column.length,
            j = 0;
          for (j = 0; j < letters; j++) {
            var letter = column[j],
              values = letter.split(':', 2);
            if (values[1] > 0.01) {
              var letter_height = parseFloat(values[1]) / this.data.max_height,
                x_pos = x,
                glyph_height = 256 * letter_height,
                y_pos = 256 - previous_height - glyph_height;

              if (borders) {
                this.contexts[context_num].strokeStyle = this.colors[values[0]];
                this.contexts[context_num].strokeRect(x_pos, y_pos, this.zoomed_column, glyph_height);
              } else {
                this.contexts[context_num].fillStyle = this.colors[values[0]];
                this.contexts[context_num].fillRect(x_pos, y_pos, this.zoomed_column, glyph_height);
              }

              previous_height = previous_height + glyph_height;
            }
          }
        }


        if (this.zoom < 0.2) {
          mod = 20;
        } else if (this.zoom < 0.3) {
          mod = 10;
        }

        if (i % mod === 0) {
          // draw column dividers
          draw_ticks(this.contexts[context_num], x + this.zoomed_column, this.height - 30, parseFloat(this.height), '#dddddd');
          // draw top ticks
          draw_ticks(this.contexts[context_num], x + this.zoomed_column, 0, 5);

          // if ali_coordinates exist and toggle is set then display the
          // alignment coordinates and not the model coordinates.
          if (this.display_ali_map) {
            column_label = this.data.ali_map[i - 1];
          } else {
            column_label = column_num;
          }
          // draw column numbers
          draw_column_number(this.contexts[context_num], x - 2,  10, this.zoomed_column, column_label, 10, true);
        }


        // draw insert probabilities/lengths
        draw_small_insert(
          this.contexts[context_num],
          x,
          this.height - 42,
          this.zoomed_column,
          this.data.insert_probs[i - 1],
          this.data.insert_lengths[i - 1],
          this.data.delete_probs[i - 1]
        );

        // draw other dividers
        draw_border(this.contexts[context_num], this.height - 45, this.total_width);
        draw_border(this.contexts[context_num], 0, this.total_width);

        x += this.zoomed_column;
        column_num++;
      }

    };

    this.toggle_scale = function () {
      // work out the current column we are on so we can return there
      var col_total = this.current_column();

      // toggle the max height
      if (this.data.max_height === this.data.max_height_obs) {
        this.data.max_height = this.data.max_height_theory;
      } else {
        this.data.max_height = this.data.max_height_obs;
      }
      // reset the rendered counter so that each section will re-render
      // with the new heights
      this.rendered = [];
      //update the y-axis
      $(this.called_on).find('.logo_yaxis').remove();
      this.render_y_axis_label();

      // re-flow and re-render the content
      this.scrollme.reflow();
      //scroll off by one to force a render of the canvas.
      this.scrollToColumn(col_total + 1);
      //scroll back to the location we started at.
      this.scrollToColumn(col_total);
    };

    this.toggle_ali_map = function () {
      // work out the current column we are on so we can return there
      var col_total = this.current_column();

      // toggle the max height
      if (this.display_ali_map === 1) {
        this.display_ali_map = 0;
      } else {
        this.display_ali_map = 1;
      }
      this.render_x_axis_label();

      // reset the rendered counter so that each section will re-render
      // with the new heights
      this.rendered = [];

      // re-flow and re-render the content
      this.scrollme.reflow();
      //scroll off by one to force a render of the canvas.
      this.scrollToColumn(col_total + 1);
      //scroll back to the location we started at.
      this.scrollToColumn(col_total);
    };

    this.current_column = function () {
      var before_left = this.scrollme.scroller.getValues().left,
        col_width = (this.column_width * this.zoom),
        col_count = before_left / col_width,
        half_visible_columns = ($(this.called_on).find('.logo_container').width() / col_width) / 2,
        col_total = Math.ceil(col_count + half_visible_columns);
      return col_total;
    };

    this.change_zoom = function (options) {
      var zoom_level = 0.3;
      if (options.target) {
        zoom_level = options.target;
      } else if (options.distance) {
        zoom_level = (parseFloat(this.zoom) - parseFloat(options.distance)).toFixed(1);
        if (options.direction === '+') {
          zoom_level = (parseFloat(this.zoom) + parseFloat(options.distance)).toFixed(1);
        }
      }

      if (zoom_level > 1) {
        zoom_level = 1;
      } else if (zoom_level < 0.1) {
        zoom_level = 0.1;
      }

      // see if we need to zoom or not
      var expected_width = ($(this.called_on).find('.logo_graphic').width() * zoom_level) / this.zoom;
      if (expected_width > $(this.called_on).find('.logo_container').width()) {
        // if a center is not specified, then use the current center of the view
        if (!options.column) {
          //work out my current position
          var col_total = this.current_column();

          this.zoom = zoom_level;
          this.render({zoom: this.zoom});
          this.scrollme.reflow();

          //scroll to previous position
          this.scrollToColumn(col_total);
        } else { // center around the mouse click position.
          this.zoom = zoom_level;
          this.render({zoom: this.zoom});
          this.scrollme.reflow();

          var coords = this.coordinatesFromColumn(options.column);
          this.scrollme.scroller.scrollTo(coords - options.offset);
        }
      }
      return this.zoom;
    };

    this.columnFromCoordinates = function (x) {
      var column = Math.ceil(x / (this.column_width * this.zoom));
      return column;
    };

    this.coordinatesFromColumn = function (col) {
      var new_column = col - 1,
        x = (new_column  * (this.column_width * this.zoom)) + ((this.column_width * this.zoom) / 2);
      return x;
    };

    this.scrollToColumn = function (num, animate) {
      var half_view = ($(this.called_on).find('.logo_container').width() / 2),
        new_left = this.coordinatesFromColumn(num);
      this.scrollme.scroller.scrollTo(new_left - half_view, 0, animate);
    };


  }

  $.fn.hmm_logo = function (options) {
    var logo = null,
      logo_graphic = $('<div class="logo_graphic">');
    if (canvasSupport()) {
      options = options || {};

      // add some internal divs for scrolling etc.
      $(this).append(
        $('<div class="logo_container">').append(logo_graphic).append('<div class="logo_divider">')
      );

      options.data = $(this).data('logo');

      if (options.data === null) {
        return;
      }

      options.dom_element = logo_graphic;
      options.called_on = this;

      var zoom = options.zoom || 0.4,
        form = $('<form class="logo_form"><fieldset><label for="position">Column number</label>' +
          '<input type="text" name="position" class="logo_position"></input>' +
          '<button class="button logo_change">Go</button></fieldset>' +
          '</form>'),
        controls = $('<div class="logo_controls">');

      logo = new HMMLogo(options);
      logo.render(options);

      if (logo.zoom_enabled) {
        controls.append('<button class="logo_zoomout button">-</button>' +
          '<button class="logo_zoomin button">+</button>');
      }

      /* we don't want to toggle if the max height_obs is greater than max theoretical
       * as letters will fall off the top.
       */
      if (logo.scale_height_enabled && (logo.data.max_height_obs < logo.data.max_height_theory)) {
        controls.append('<button class="logo_scale button">Toggle Scale</button>');
      }

      if (logo.data.ali_map) {
        controls.append('<button class="logo_ali_map button">Toggle Alignment Coordinates</button>');
      }

      form.append(controls);
      $(this).append(form);


      $(this).find('.logo_reset').bind('click', function (e) {
        e.preventDefault();
        var hmm_logo = logo;
        hmm_logo.change_zoom({'target': hmm_logo.default_zoom});
      });

      $(this).find('.logo_change').bind('click', function (e) {
        e.preventDefault();
      });

      $(this).find('.logo_zoomin').bind('click', function (e) {
        e.preventDefault();
        var hmm_logo = logo;
        hmm_logo.change_zoom({'distance': 0.1, 'direction': '+'});
      });

      $(this).find('.logo_zoomout').bind('click', function (e) {
        e.preventDefault();
        var hmm_logo = logo;
        hmm_logo.change_zoom({'distance': 0.1, 'direction': '-'});
      });

      $(this).find('.logo_scale').bind('click', function (e) {
        e.preventDefault();
        var hmm_logo = logo;
        hmm_logo.toggle_scale();
      });

      $(this).find('.logo_ali_map').bind('click', function (e) {
        e.preventDefault();
        var hmm_logo = logo;
        hmm_logo.toggle_ali_map();
      });

      $(this).find('.logo_position').bind('change', function () {
        var hmm_logo = logo;
        if (!this.value.match(/^\d+$/m)) {
          return;
        }
        hmm_logo.scrollToColumn(this.value, 1);
      });

      logo_graphic.bind('dblclick', function (e) {
        // need to get coordinates of mouse click
        var hmm_logo = logo,
          offset = $(this).offset(),
          x = parseInt((e.pageX - offset.left), 10),

          // get mouse position in the window
          window_position = e.pageX - $(this).parent().offset().left,

          // get column number
          col = hmm_logo.columnFromCoordinates(x),

          // choose new zoom level and zoom in.
          current = hmm_logo.zoom;

        if (current < 1) {
          hmm_logo.change_zoom({'target': 1, offset: window_position, column: col});
        } else {
          hmm_logo.change_zoom({'target': 0.3, offset: window_position, column: col});
        }

        return;
      });

      if (options.column_info) {
        logo_graphic.bind('click', function (e) {
          var hmm_logo = logo,
            info_tab = $('<table class="logo_col_info"></table>'),
            header = '<tr>',
            tbody  = '',
            offset = $(this).offset(),
            x = parseInt((e.pageX - offset.left), 10),

            // get mouse position in the window
            window_position = e.pageX - $(this).parent().offset().left,

            // get column number
            col = hmm_logo.columnFromCoordinates(x),
            // clone the column data before reversal or the column gets messed
            // up in the logo when zoom levels change. Also stops flip-flopping
            // of the order from ascending to descending.
            col_data = [],
            info_cols = 0,
            i = 0,
            j = 0,
            height_header = 'Probability';

          if (logo.data.height_calc && logo.data.height_calc === 'score') {
            height_header = 'Score';
            col_data = logo.data.height_arr[col - 1].slice(0).reverse();
          } else {
            col_data = logo.data.probs_arr[col - 1].slice(0).reverse();
          }

          info_cols = Math.ceil(col_data.length / 5);
          //add the headers for each column.
          for (i = 0; i < info_cols; i++) {
            // using the i < info_cols - 1 check to make sure the last column doesn't
            // get marked with the odd class so we don't get a border on the edge of the table.
            if (info_cols > 1 && i < (info_cols - 1)) {
              header += '<th>Residue</th><th class="odd">' + height_header + '</th>';
            } else {
              header += '<th>Residue</th><th>' + height_header + '</th>';
            }
          }


          header += '</tr>';
          info_tab.append($(header));

          // add the data for each column
          for (i = 0; i < 5; i++) {
            tbody += '<tr>';
            j = i;
            while (col_data[j]) {
              var values = col_data[j].split(':', 2);
              // using the j < 15 check to make sure the last column doesn't get marked
              // with the odd class so we don't get a border on the edge of the table.
              if (info_cols > 1  &&  j < 15) {
                tbody += '<td class="' + logo.alphabet + '_' + values[0] + '"><div></div>' + values[0] + '</td><td class="odd">' + values[1] + '</td>';
              } else {
                tbody += '<td class="' + logo.alphabet + '_' + values[0] + '"><div></div>' + values[0] + '</td><td>' + values[1] + '</td>';
              }

              j += 5;
            }
            tbody += '</tr>';
          }

          info_tab.append($(tbody));

          $(options.column_info).empty()
            .append($('<p> Column:' + col  + '</p><div><p>Occupancy: ' + logo.data.delete_probs[col - 1] + '</p><p>Insert Probability: ' + logo.data.insert_probs[col - 1] + '</p><p>Insert Length: ' + logo.data.insert_lengths[col - 1] + '</p></div>'))
            .append(info_tab).show();
        });
      }

      $(document).bind(this.attr('id') + ".scrolledTo", function (e, left, top, zoom) {
        var hmm_logo = logo;
        hmm_logo.render({target: left});
      });

      $(document).keydown(function (e) {
        if (!e.ctrlKey) {
          if (e.which === 61 || e.which === 107) {
            zoom += 0.1;
            logo.change_zoom({'distance': 0.1, 'direction': '+'});
          }
          if (e.which === 109 || e.which === 0) {
            zoom = zoom - 0.1;
            logo.change_zoom({'distance': 0.1, 'direction': '-'});
          }
        }
      });

    } else {
      $('#logo').replaceWith($('#no_canvas').html());
    }

    return logo;
  };
})(jQuery);
