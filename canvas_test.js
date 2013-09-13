/*jslint browser:true */

(function ($) {
  "use strict";

  $(document).ready(function () {
    $('body').append('<canvas class="canvas_logo" id="canv_1"  height="5000" width="10000"></canvas>');


    function Letter(letter, options) {

      options = options || {};
      this.value = letter;
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d');
      this.width = parseInt(options.width, 10) || 100;
      this.height = parseInt(options.height, 10) || 100;
      this.color = options.color || '#000000';
      this.fontSize = options.fontSize || 138;

      this.scaled = function () { };

      this.draw = function (ext_ctx, target_height, target_width, x, y) {
        var h_ratio = target_height / this.height,
          w_ratio = target_width / this.width;
        ext_ctx.transform(w_ratio, 0, 0, h_ratio, x, y);
        ext_ctx.drawImage(this.canvas, 0, 0);
        ext_ctx.setTransform(1, 0, 0, 1, 0, 0);
      };

      // initial setup of internal canvas
      $(this.canvas).attr('height', this.height).attr('width', this.width);
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.font = "bold " + this.fontSize + "px Arial";
      this.ctx.clearRect(0, 0, this.height, this.width);
      this.ctx.fillStyle = this.color;
      this.ctx.textAlign = "center";
      this.ctx.fillText(this.value, this.width / 2, this.height);
    }

    var canvas = $('body').find('#canv_1'),
      ctx = canvas[0].getContext('2d'),
      i = 0,
      l = 0,
      x = 0,
      height = 10,
      letter_count = 0,
      letter_objs = {},
      letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

    $(letters).each(function () {
      var options = {};
      if (this === 'W') {
        options.color = '#ff0000';
        options.width = 130;
        options.height = 100;
      }
      letter_objs[this] = new Letter(this, options);
    });


    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, 10000, 500);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 10000, 500);

    for (i = 0; i < 76; i++) {
      x = i * 60;
      letter_objs[letters[letter_count]].draw(ctx, height, 30, x, 10);
      height += 5;
      letter_count++;
      if (letter_count > 25) {
        letter_count = 0;
      }
    }

    // draw a bunch of rectangle targets.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.font = "bold 15px Arial";
    ctx.textAlign = "left";
    ctx.fillStyle = "#cccccc";
    height = 10;
    for (i = 0; i < 76; i++) {
      ctx.strokeStyle = '#cccccc';
      var x = i * 60;
      ctx.strokeRect(x, 10, 30, height);
      height += 5;
      ctx.fillText(height, x, height + 20);
    }

  });

})(jQuery);
