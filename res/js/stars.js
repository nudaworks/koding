function Stars() {
    var that = this;

    this.rootEl = document.body.querySelector('.stars');

    this.rootEl.addEventListener('mouseover', function (e) {
        if (e.target.classList.contains('star')) {
            that.uncolorAll();
            that.colorTo(e.target);
        }
    });

    this.rootEl.addEventListener('mouseout', function (e) {
        var selected = that.rootEl.querySelector('.selected');
        that.uncolorAll();
        selected && that.colorTo(selected);
    });

    this.rootEl.addEventListener('click', function (e) {
        if (e.target.classList.contains('star')) {
            that.rateThis(e.target);
        }
    });

    this.colorTo = function (starNode) {
        var child = starNode;
        while (child) {
            child.classList.add('active');
            child = child.previousElementSibling;
        }
    };

    this.uncolorAll = function () {
        $(this.rootEl).find('.star').toArray().map(function (item) {
            item.classList.remove('active');
        });
    };

    this.rateThis = function (starNode) {
        $(this.rootEl).find('.star').toArray().map(function (item) {
            item.classList.remove('selected');
        });
        starNode.classList.add('selected');

        $('.stars').attr('data-rated', $('.stars .active').length);
    }
}

