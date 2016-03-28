$(function(){

    // APP

    window.App = {
        Models: {},
        Collections: {},
        Views: {},
        Router: {},
        State: {
            lastProductId: null,
            productsIds: []
        },
        Config: {
            appNode: $('.app-container'),
            apiUrl: 'http://platon.tk/_json/'
        }
    };


    // PROTOTYPES

    App.Models.Product = Backbone.Model.extend({});

    App.Models.Review = Backbone.Model.extend({});

    App.Models.User = Backbone.Model.extend({
        validate: function(attrs){
            if(attrs.email && !attrs.email.isValidEmail())
                return {
                    attr: 'email',
                    msg: 'Your mail is not valid'
                };

            if(attrs.pswd && attrs.pswd.length < 10){
                return {
                    attr: 'pswd',
                    msg: 'Your pswd is not valid'
                };
            }
        }
    });

    App.Collections.Products = Backbone.Collection.extend({
        model: App.Models.Product,
        url: App.Config.apiUrl + 'products',
        initialize: function(){
            var that = this;
            this.fetch({
                success: function(){
                    Backbone.Events.trigger('productsFetched');
                    // обновляем список ID моделей,
                    // для упрощения вычислений в шаблонах
                    _.each(that.models, function(m){
                        App.State.productsIds.push(m.get('id'));
                    });
                }
            });
        }
    });

    App.Collections.Reviews = Backbone.Collection.extend({
        model: App.Models.Review,
        url: App.Config.apiUrl + 'reviews'
    });

    App.Views.Product = Backbone.View.extend({
        template: _.template($('script[data-template="product"]').html()),
        templateReviews: _.template($('script[data-template="reviews"]').html()),
        initialize: function(){
            Backbone.Events.on('drawProduct', this.renderReviews, this);
            Backbone.Events.on('reviewPosted', this.renderReviews, this);
        },
        render: function(id){
            var that = this;
            // проверяем, добаввлена ли коллекция модель с текущим товаром
            if (this.collection.has(id)){
                // если добавлена, проверяем, есть ли в ней описание
                if (this.collection.get(id).has('description')){
                    // если есть описание, значит есть и другие данные - отрисовываем шаблон
                    this.$el.html(that.template(that.collection.get(id).attributes)); // (A)
                    Backbone.Events.trigger('drawProduct', id);
                } else {
                    // отрисовываем шаблон с получением данных
                    this.renderProduct(id);
                }
            } else {
                // если модель не добавлена в коллекции, значит ждем, пока будет добавлена
                Backbone.Events.once('productsFetched', function(){
                    that.renderProduct(id);
                });
            }
        },
        renderProduct: function(id){
            var that = this;
            this.collection.get(id).fetch({
                success: function(){
                    $(that.el).html(that.template(that.collection.get(id).attributes)); // (A)
                    Backbone.Events.trigger('drawProduct', id);
                }
            });
        },
        renderReviews: function(id){
            id = id || App.State.lastProductId;
            var that = this;

            new App.Views.LeaveReview({
                el: $('.leave-review'),
                collection: this.collection
            });

            $.ajax({
                url: App.Config.apiUrl + 'reviews/' + id
            }).done(function(response){
                that.collection.get(id).set('reviews', JSON.parse(response));
                $('.review-list').html(that.templateReviews(JSON.parse(response)));
                Backbone.Events.trigger('reviewsRendered', id);
            });
        }
    });

    App.Views.Grid = Backbone.View.extend({
        isFirstTime: true,
        template: _.template($('script[data-template="grid"]').html()),
        initialize: function() {
        },
        render: function() {
            this.$el.html(this.template({ models: this.collection.models }));
        }
    });

    App.Views.Simple = Backbone.View.extend({
        template: function(tplName) {
            return _.template($('script[data-template="' + tplName + '"]').html());
        },
        render: function(tplName) {
            this.$el.html(this.template(tplName));
        }
    });

    App.Views.Auth = Backbone.View.extend({
        // View: Обслуживает содержимое страницы #auth
        initialize: function(){
            // указываем, куда будут выводится сообщения об неправильности вводимых данных
            this.model.on('invalid', function(e){
                $('.' + e.validationError.attr + '-error').html(e.validationError.msg);
            });
        },
        template: _.template($('script[data-template="auth"]').html()),
        events: {
            'change input': 'validateInput',
            'click .butt-submit': 'submitForm'
        },
        render: function(){
            this.$el.html(this.template());
        },
        validateInput: function(e){
            // опустошаем поля с ошибками, чтобы при очищении полей ввода ошибка не "висела"
            $('.error-box').html('');

            var email = $('#input-email').val().trim();
            var pswd = $('#input-pswd').val().trim();
            var isSuccess;

            // валидируем поля, в случае ошибки в соотв. поле появится ошибка;
            // в случае, если пользователь вводит правильные (валидные) данные с т.з приложения,
            // но не те данные, что хотел (напр. опечаталася) и затем ввел невалидные данные,
            // то удалить ранее введенные записи из модели,
            // чтобы предупредить отправку нежелетальных данных для регистрации
            if (email) {
                isSuccess = this.model.set({email: email}, {validate: true});
                if (!isSuccess && this.model.has('email')) {
                    this.model.unset('email');
                }
            }
            if (pswd) {
                isSuccess = this.model.set({pswd: pswd}, {validate: true});
                if (!isSuccess && this.model.has('pswd')) {
                    this.model.unset('pswd');
                }
            }
        },
        submitForm: function(){
            // если данные валидны, а в модель записываются только валидные данные,
            // то передать инициативу App.Views.User на отправку этих данных серверу
            if (this.model.has('email') && this.model.has('pswd')){
                Backbone.Events.trigger('loginDataIsValid');
            }
        }
    });

    App.Views.User = Backbone.View.extend({
        // View: обслуживает плавающий блок с автаркой, управляет аутентификацией/регистрацией пользов.
        // два шаблона: для залогиненых и незалогиненых пользователей
        template: _.template($('script[data-template="user_authed"]').html()),
        templateDefault: _.template($('script[data-template="user_not_authed"]').html()),
        events: {
            'click .action-logout': 'logout'
        },
        initialize: function(){
            var that = this;
            // проверяем есть ли в куках логин, пароль
            var email = getCookie('email');
            var pswd = getCookie('pswd');
            var token = getCookie('token');

            if (email && pswd && token) {
                // отсылаем данные на сервер на проверку
                $.ajax({
                    url: App.Config.apiUrl + 'auth',
                    type: 'POST',
                    data: {
                        email: email,
                        pswd: pswd,
                        token: token
                    }
                }).done(function(response){
                    if (response.length) {
                        var objResponse = JSON.parse(response);
                        that.auth(objResponse);

                    } else {
                        that.$el.html('sdfsf');
                    }
                });
            } else {
                this.renderDefault();
            }

            Backbone.Events.on('loginDataIsValid', this.login, this);
        },
        auth: function(objResponse){
            var that = this;
            // записываем данные пользователя в модель
            _.each(objResponse, function(key, i){
                that.model.set(i, objResponse[i]);
            });
            // пишем данные пользователя в куки, чтобы они созранились при перезагрузке страницы
            setCookie('email', objResponse.email);
            setCookie('pswd', objResponse.pswd);
            setCookie('token', objResponse.token);

            that.$el.html(that.template(that.model.attributes));

            setTimeout((function(){
                Backbone.Events.trigger('userLoggedIn')
            }), 1000);
        },
        login: function(){
            var that = this;
            // отсылаем запрос на авторизацию
            $.ajax({
                url: App.Config.apiUrl + 'login',
                type: 'POST',
                data: {
                    email: this.model.get('email'),
                    pswd: this.model.get('pswd')
                }
            }).done(function(response){
                // если есть такой пользователь, то аутентифицируем его
                if (response.length) {
                    that.auth(JSON.parse(response));
                    history.back();
                } else {
                    // иначе предлагает зарегистрироваться
                    $('.tpl-auth .sheet').css('margin-left', '-20em');
                    setTimeout((function(){
                        $('.tpl-auth .sheet').css('margin-left', '-40em');
                        // если пользователь согласен, то создаем запись в БД и а утентифицируем
                        $('button.yes').on('click', function(){
                            that.register();
                        });
                        // иначе возвращаем к полям входа
                        $('button.no').on('click', function(){
                            $('.tpl-auth .sheet').css('margin-left', '0');
                        });
                    }), 3000);
                }
            });
        },
        logout: function(){
            console.info('logout started');
            // отсылаем серверу запрос на удаление токена
            // (по логике приложения, наличие токена в БД означает, что пользователь залогинен)
            $.ajax({
                url: App.Config.apiUrl + 'logout',
                type: 'POST',
                data: {
                    token: getCookie('token')
                }
            });
            // удаляем куки
            deleteCookie('email');
            deleteCookie('pswd');
            deleteCookie('token');
            // удаляем данные из модели
            this.model.clear();
            // обновляем содержимое блока пользователя
            this.renderDefault();
            // сообщаем другим компонентам о "выходе" пользователя,
            // чтобы они, при необходимости обновили свое содержимое
            Backbone.Events.trigger('userLoggedOut');
        },
        register: function(){
            var that = this;
            $.ajax({
                url: App.Config.apiUrl + 'register',
                type: 'POST',
                data: {
                    email: this.model.get('email'),
                    pswd: this.model.get('pswd')
                }
            }).done(function(response) {
                // если гегистриция прошла успешно, то аутентифицируем его
                if (response.length) {
                    that.auth(JSON.parse(response));
                }
            });
            history.back();
        },
        renderDefault: function(){
            this.$el.html(this.templateDefault);
        }
    });

    App.Views.LeaveReview = Backbone.View.extend({
        template: _.template($('script[data-template="leave_review"]').html()),
        initialize: function(){
            Backbone.Events.on('reviewsRendered', this.render, this);
            Backbone.Events.on('userLoggedOut', this.render, this);
            Backbone.Events.on('userLoggedIn', this.render, this);
        },
        events: {
            'click .action-submit-review': 'validateReview'
        },
        render: function(id){
            id = id || App.State.lastProductId;
            // залогинен ли пользователь
            if (user.has('id')){
                // оставлял ли он комментарий?
                var check = _.where(this.collection.get(id).get('reviews'), {user_id: user.get('id')});
                if (check.length){
                    this.thankForReview();
                } else {
                    this.showReviewForm();
                }
            } else {
                this.showPleaseAuthMsg();
            }
        },
        thankForReview: function(){
            this.$el.html('<div class="notice">You have already posted a review about this product. Thanx a lot for your feedback :)</div>');
        },
        showPleaseAuthMsg: function(){
            this.$el.html('<div class="notice">You have to be <a href="#auth">authentificated</a> user to leave reviews</div>');
        },
        showReviewForm: function(){
            this.$el.html(this.template);
            setTimeout((function(){
                new Stars();
            }), 1000);
        },
        validateReview: function(){
            var that = this;
            $('.error-box').text('');
            var text = $('textarea').val().trim();
            var rate = $('.stars').attr('data-rated');

            if (text.length < 10) {
                $('.error-box').text('Your review is too short');
                return;
            } else if (!rate) {
                $('.error-box').text('Please, rate this product');
                return;
            } else {
                $.ajax({
                    url: App.Config.apiUrl + 'addreview',
                    type: 'POST',
                    data: {
                        token: getCookie('token'),
                        text: text,
                        rate: rate,
                        product_id: App.State.lastProductId
                    }
                }).done(function(response){
                    // скрываем поле ввода отзыва
                    that.thankForReview();
                    // инициируем перерисовку списка отзывов
                    Backbone.Events.trigger('reviewPosted');
                });
            }
        }
    });

    App.Router = Backbone.Router.extend({
        routes: {
            '': 'index',
            'about': 'about',
            'products': 'grid',
            'products/:id': 'product',
            'auth': 'auth'
        },

        index: function(){
            simpleView.render('intro');
            this.markRoute('intro');
        },
        grid: function(){
            if (gridView.isFirstTime) {
                if (gridView.collection.length > 1) {
                    gridView.render();
                } else {
                    gridView.listenToOnce(gridView.collection, 'sync', gridView.render);
                    gridView.isFirstTime = false;
                }
            } else {
                gridView.render();
            }
            this.markRoute('grid');
        },
        about: function(){
            simpleView.render('about');
            this.markRoute('about');
        },
        product: function(id){
            App.State.lastProductId = id;
            productView.render(id);
            this.markRoute('product');
        },
        auth: function() {
            authView.render();
            this.markRoute('auth');
        },
        markRoute: function(route) {
            $('html').removeClass().addClass('curr-page-' + route);
        }
    });

    // INSTANCES
    var user = new App.Models.User({});
    var products = new App.Collections.Products({});


    var gridView = new App.Views.Grid({
        el: App.Config.appNode,
        collection: products
    });

    var simpleView = new App.Views.Simple({
        el: App.Config.appNode
    });

    var productView = new App.Views.Product({
        el: App.Config.appNode,
        collection: products
    });

    var authView = new App.Views.Auth({
        model: user,
        el: App.Config.appNode
    });

    var userView = new App.Views.User({
        model: user,
        el: $('.app-userbar')
    });




    new App.Router();
    Backbone.history.start();


});