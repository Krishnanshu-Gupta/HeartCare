
Vue.use(AsyncComputed);
Vue.use(VueTheMask);

Vue.use(VeeValidate, {
    classes: true,
    strict: false,
    validity: true
});

Vue.component('paypal-button', {
    props: {
        validator: {
            type: Function,
            required: false
        }
    },
    template: '<div id="paypal-checkout" style="margin:auto;max-width:350px" />',
    mounted: function() {
        var self = this;
        function renderButton() {
            if (window.paypal) {
                clearInterval(self.paypalCheckoutReady);
                var gateway = Givecloud.config.gateways.paypal;
                var style = {
                    type: 'checkout',
                    size: 'medium',
                    shape: 'pill',
                    color: 'gold'
                };
                if (gateway === 'paypalcheckout') {
                    style = {
                        label: 'pay',
                        size: 'responsive',
                        shape: 'pill',
                        color: 'gold',
                        tagline: false
                    };
                }
                Givecloud.Gateway(gateway).renderButton({
                    id: 'paypal-checkout',
                    style: style,
                    validateForm: self.validator,
                    onPayment: function() {
                        self.$emit('click');
                    }
                });
            }
        }

        // delay rendering to allow time for PayPal to load
        this.paypalCheckoutReady = setInterval(renderButton.bind(this), 10);
    },
    beforeDestroy: function() {
        if (this.paypalCheckoutReady) {
            clearInterval(this.paypalCheckoutReady);
        }
    }
});

Vue.component('credit-card', {
    template: '<div class="credit-card-fields"><slot></slot></div>',
    computed: {
        gateway: function() {
            return Givecloud.PaymentTypeGateway('credit_card');
        }
    },
    mounted: function() {
        if (this.gateway.$name === 'paysafe' && document.getElementById('inputPaymentNumber')) {
            this.gateway.setupFields({
                cardNumber: {
                    selector: '#inputPaymentNumber',
                    placeholder: '0000 0000 0000 0000',
                    separator: ' '
                },
                expiryDate: {
                    selector: '#inputPaymentExpiry',
                    placeholder: 'MM / YY'
                },
                cvv: {
                    selector: '#inputPaymentCVV',
                    placeholder: '000',
                    optional: false
                }
            });
        }
    },
});

Vue.component('payment-field', {
    props: {
        field: {
            type: String,
            required: true
        }
    },
    computed: {
        gateway: function() {
            return Givecloud.PaymentTypeGateway('credit_card');
        },
        usesHostedPaymentFields: function() {
            return this.gateway && this.gateway.usesHostedPaymentFields();
        }
    },
    template: '<div><div v-if="usesHostedPaymentFields" :id="field" class="form-control gateway-form-control"></div><slot v-else></slot></div>',
});

Vue.component('modal', {
    props: {
        show: {
            type: Boolean,
            required: true,
            default: false
        },
        id: {
            type: String,
            required: true
        },
        delay: {
            type: Number,
            required: false,
            default: 0
        },
        label: {
            type: String,
            required: true
        },
        preventPassiveClose: {
            type: Boolean,
            required: false,
            default: false
        }
    },
    data: function () {
        return {
            overlayTimer: null,
            modal: null
        };
    },
    watch: {
        show: function (newVal, oldVal) { // watch it
            if (oldVal !== newVal) {
                if (newVal === true) {
                    this.overlayTimer = setTimeout(theme.arrow(this, function () {
                        this.overlayTimer = null;
                        this.modal.show();
                    }), this.delay);
                } else {
                    if (this.overlayTimer) {
                        clearTimeout(this.overlayTimer);
                        this.overlayTimer = null;
                    } else {
                        this.modal._isTransitioning = false;
                        this.modal.hide();
                    }
                }
            }
        }
    },
    mounted: function () {
        var $el = $(this.$refs.el);
        this.modal = $el.modal({
            backdrop: (this.preventPassiveClose ? 'static' : true),
            keyboard: (this.preventPassiveClose ? false : true),
            show: this.show
        }).data('bs.modal');
        $el.on('hidden.bs.modal', theme.arrow(this, function() { this.$emit('closed')}));
      },
    template: '<div class="modal fade" ref="el" :id="id" tabindex="-1" role="dialog" :aria-label="label" aria-hidden="true"><div class="modal-dialog" role="document"><slot></slot></div></div>'
});

Vue.component('vue-recaptcha', {
    template: '<div/>',
    props: {
        sitekey: {
            type: String,
            required: true
        }
    },
    mounted: function () {
        var self = this;
        this.$captchaType = Givecloud.config.captcha_type || 'recaptcha';
        if (this.$captchaType === 'hcaptcha') {
            theme.waitFor('hcaptcha.render').then(function () {
                self.$widgetId = hcaptcha.render(self.$el, {
                    sitekey: self.sitekey,
                    callback: self.emitVerify
                });
            });
        } else if (this.$captchaType === 'recaptcha') {
            window.vueCaptchaApiPromise.then(function () {
                self.$widgetId = grecaptcha.render(self.$el, {
                    sitekey: self.sitekey,
                    callback: self.emitVerify
                });
            });
        }
    },
    methods: {
        reset: function() {
            if (this.$captchaType === 'hcaptcha') {
                hcaptcha.reset(this.$widgetId);
            } else if (this.$captchaType === 'recaptcha') {
                grecaptcha.reset(this.$widgetId);
            }
        },
        emitVerify: function(response) {
            this.$emit('verify', response);
        }
    }
});

window.vueCaptchaApiPromise = new Promise(function(resolve, reject) {
    window.vueCaptchaApiLoaded = function(){
        resolve();
    };
});

VeeValidate.Validator.extend('credit_card', Givecloud.CardholderData.validNumber);
VeeValidate.Validator.extend('expiration_date', Givecloud.CardholderData.validExpirationDate);

VeeValidate.Validator.extend('cvv', function(value, args) {
    return Givecloud.CardholderData.validCvv(value, args[0]);
});


window.theme = window.theme || {};

/*================ Sections ================*/
// =require sections/header.js

/*================ Templates ================*/
// =require templates/accounts-payment-methods.js
// =require templates/accounts-login.js


/**
 * Core theme functions.
 */

theme.arrow = function(context, fn) {
    return fn.bind(context);
};

theme.noop = function() {};

theme.waitFor = function(property) {
    return new Promise(function (resolve, reject) {
        (function themeWait() {
            var value = Sugar.Object.get(window, property)
            if (value) return resolve();
            setTimeout(themeWait, 30);
        })();
    });
};

theme.data_get = function(data, property, defaultValue) {
    var value = Sugar.Object.get(data, property);
    if (value === '' || value === null || typeof value === 'undefined') {
        return defaultValue;
    } else {
        return value;
    }
};

theme.data_set = function(data, property, value) {
    Sugar.Object.set(data, property, value);
};

theme.toNumber = function(number, defaultValue) {
    if (defaultValue === void 0) {
        defaultValue = null;
    }
    if (typeof number === 'number') {
        return number;
    } else if (typeof number === 'string') {
        number = Sugar.String.toNumber(number);
        return isNaN(number) ? defaultValue : number;
    }
    return defaultValue;
};

theme.formatNumber = function(number, precision) {
    return Sugar.Number.format(theme.toNumber(number), precision || 2);
};

theme.ladda = {
    create: function(element) {
        if (typeof element === 'string') {
            element = document.querySelector(element);
        }
        if (element) {
            return element.ladda = element.ladda || Ladda.create(element);
        }
    },
    start: function(element) {
        var btn = theme.ladda.create(element);
        if (btn) btn.start();
        return btn;
    },
    stop: function(element) {
        var btn = theme.ladda.create(element);
        if (btn) btn.stop();
        return btn;
    }
};

theme.error = function(text) {
    if (Sugar.Object.isError(text) || Sugar.Object.isObject(text)) {
        console.error(text);
        try {
            text = theme.data_get(text, 'response.data.error')
                || theme.data_get(text, 'response.data.message')
                || theme.data_get(text, 'response.message')
                || theme.data_get(text, 'error.message')
                || theme.data_get(text, 'message')
                || theme.data_get(text, 'error')
                || text;
        } catch(err) {
            text = 'Unknown error (521)';
        }
    }
    return String(text).replace(/[\n\r]/, '<br>');
};

theme.toast = (function() {
    var instance = new Toasted({
        theme: 'primary',
        position: 'top-center',
        duration : 6000,
        singleton: true
    });
    function toast(type, text, opts) {
        return instance[type].call(instance, theme.error(text), opts);
    }
    return {
        error:   toast.bind(instance, 'error'),
        info:    toast.bind(instance, 'info'),
        success: toast.bind(instance, 'success'),
        warning: toast.bind(instance, 'warning')
    };
})();

theme.scrollIntoView = function(element, offset, duration, easing) {
    try {
        element = $(element);
    } catch (err) {
        return Promise.reject(err);
    }
    if (element.length) {
        return new Promise(function(resolve, reject) {
            element.velocity('scroll', {
                offset: offset ? (1 - offset) : 0,
                easing: easing || 'swing',
                duration: duration || 250,
                mobileHA: false,
                complete: function(){
                    resolve(element);
                }
            });
        });
    } else {
        return Promise.reject();
    }
};

theme.cartPreview = function(cart) {
    // slide out a div from the right panel
    // that shows a preview of the cart with
    // a checkout button
};

theme.bsFormValidate = function(form){
    var result =  form.checkValidity();
    $(form).addClass('was-validated');
    $(form).find('.btn-group-toggle').parents('.form-group').removeClass('has-errors');
    $(form).find('.btn-group-toggle input[type=radio]:invalid').parents('.form-group').addClass('has-errors');
    $(form).find('.btn-group-toggle input[type=number]:invalid').parents('.form-group').addClass('has-errors');
    theme.product.checkValidity(form);
    return result;
};

theme.bsFormResetValidation = function(form){
    $(form).removeClass('was-validated');
};

$(document).ready(function(){

    var token = $('meta[name="csrf-token"]').text();
    if (token) {
        $.ajaxSetup({
            headers: { 'X-CSRF-TOKEN': token }
        });
    }

    new WOW().init({
        'offset'   : 20,
        'duration' : '1s',
        'mobile'   : false
    });

    $('body').on('click', 'a[href^="#"]:not([data-toggle],[data-slide])', function(e) {
        e.preventDefault();
        theme.scrollIntoView($(this).attr('href'), 40, 1500, 'ease-in-out').catch(theme.noop);
    });

    $('.odometer[data-odometer-update]').appear(function(e) {
        this.innerHTML = $(this).data('odometer-update');
    });

    $('a[data-video-id]').each(function() {
        $(this).modalVideo({
            channel: $(this).data('channel') || 'youtube'
        });
    });

    $('a[data-video-url]').modalVideo();

    $('.flipclock[data-countdown]').each(function() {
        var d = Sugar.Date.create($(this).data('countdown'));
        var seconds = isNaN(d) ? 0 : Math.max(0, Sugar.Date.secondsFromNow(d));
        $(this).FlipClock(seconds, {
            clockFace: 'DailyCounter',
            countdown: true,
            showSeconds: !!$(this).data('show-seconds')
        });
    });

    $('[data-toggle="tooltip"]').tooltip();

    function applyMasonry(selector, columns) {
        var options = {
            container: selector,
            trueOrder: true,
            waitForImages: true,
            margin: 32,
            columns: 3,
            breakAt: {
                768: 2,
                576: 1
            }
        };
        $(selector).addClass('macyjs').each(function() {
            Macy(options);
        });
    }

    applyMasonry('.masonry-2', 2);
    applyMasonry('.masonry-3', 3);
    applyMasonry('.masonry-4', 4);

    function checkIfStickyDivShouldShow() {
        var scrollTop = $(this).scrollTop();
        $('.sticky-div').each(function (_, div) {
            var $div = $(div);
            var $showAfter = $($div.data('sticky-after'));
            var offset = $showAfter.offset();
            if (offset.top >= scrollTop) {
                $div.addClass('hide-important');
            } else {
                $div.removeClass('hide-important');
            }
        });
    }

    if ($('.sticky-div').length > 0) {
        /*
            NOTE:
            *Debouncing* poses issues because on some mobile phones, they utilize
            "smooth scroll" which means that scrolling lasts a looooong time and
            so the sticky takes a long time to show/hide

            *Throttling* also poses issues because it triggers only once in the time
            frame. If it triggers while your sticky "shouldn't show" but you keep
            scrolling and stop within the time frame, it won't trigger again, so the
            sticky that should show, won't

            Given these scenarios, I've (Kory) opted to add both. Better than it
            executing on every scroll event, there is probably a better solution
            out there but I've hit the limit of how much time I want to invest.
        */
        $(window).scroll(Sugar.Function.debounce(checkIfStickyDivShouldShow, 300));
        $(window).scroll(Sugar.Function.throttle(checkIfStickyDivShouldShow, 300));
        checkIfStickyDivShouldShow();
    }


    $('.add-sponsorship-options input[name="payment_option_amount"]').on('click', function(e) {
        e.stopPropagation();
        var $this = $(this), $parent = $this.parents('.btn');
        $parent.find('input[type=radio]').click();
        setTimeout(function() { $this.focus(); }, 50);
    });

    $('.add-sponsorship-options input[name="payment_option_id"]').on('change', function(e) {
        $('.add-sponsorship-options input[name="payment_option_amount"]').val('');
        if (!$(this).parents('.btn').hasClass('is-custom')) {
            $(this).parents('.btn-group-toggle').find('input.form-control').val('');
        }
    });

    $('.social-actions a.btn').on('click', function (e) {
        e.preventDefault();
        window.open(this.href, '_blank', 'height=300,width=550,resizable=1');
    });

    $(document).on('click', '[data-toggle="lightbox"]', function(ev) {
        ev.preventDefault();
        $(this).ekkoLightbox();
    });

    $('.read-more').on('click', function(ev){
        ev.preventDefault();
        $($(this).attr('href')).addClass('read-more-content-open');
        $(this).remove();
    });

    $('.search-toggle').on('click', function(e) {
        e.preventDefault();
        var $search = $('.site-search').addClass('active');
        setTimeout(function() {
            $search.find('input[type=text]').focus();
        }, 250);
    });

    $('.site-search__close').on('click', function(e) {
        e.preventDefault();
        $('.site-search').removeClass("active");
    });

    $('.quill-editor').each(function(i, el){
        var quill = new Quill(el, {
            modules: {
                toolbar: [
                    [{ header: [1, 2, false] }],
                    ['bold', 'italic'],
                    ['link']
                ]
            },
            placeholder: 'Compose an epic...',
            theme: 'snow'  // or 'bubble'
        });

        $(el).parents('form').first().on('submit',function(ev){
            $('#' + $(el).data('input')).val($(el).find('.ql-editor').html());
        });
    });

    $('form[data-confirm]').each(function(i,form){
        $(form).on('submit',function(ev){
            if (!$(ev.target).data('is_confirmed')) {
                $modal = $('<div class="modal fade" id="form-confirm-modal" tabindex="-1" role="dialog" aria-labelledby="form-confirm-modal-label" aria-hidden="true">' +
                    '<div class="modal-dialog" role="document">' +
                        '<div class="modal-content">' +
                            '<div class="modal-header">' +
                                '<h5 class="modal-title">Confirm</h5>' +
                                '<button type="button" class="close" data-dismiss="modal" aria-label="Close">' +
                                    '<span aria-hidden="true">&times;</span>' +
                                '</button>' +
                            '</div>' +
                            '<div class="modal-body">' + $(ev.target).data('confirm') + '</div>' +
                            '<div class="modal-footer">' +
                                '<button type="button" data-dismiss="modal" class="btn-confirm btn btn-outline-primary"><i class="fa fa-check"></i> Yes</button>' +
                                '<button type="button" data-dismiss="modal" class="btn btn-primary"><i class="fa fa-times"></i> No</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>')
                    .data('original_form', ev.target)
                    .appendTo('body')
                    .modal();

                $modal.find('.btn-confirm').on('click', function(ev){
                    $($(ev.target)
                        .parents('.modal')
                        .first()
                        .data('original_form'))
                            .data('is_confirmed', true)
                            .submit();
                });

                ev.preventDefault();
            }
        });
    });

    // Update the DOM when changes are made to the account
    Givecloud.Account.subscribe(function(account) {
        if (document.getElementById('nav-create-account')) {
            $('#nav-create-account').remove();
            $('#nav-signin').replaceWith([
                '<li class="nav-item">',
                '    <a class="nav-link" href="#">',
                '        Hi, <i class="fa fa-fw fa-user-circle-o"></i> <strong>' + account.display_name + '</strong> &nbsp;',
                '    </a>',
                '</li>',
            ].join(''));
        }
    });

    // Update the DOM when changes are made to the cart
    Givecloud.Cart().subscribe(function(cart) {
        $('.-cart-count').each(function(){
            this.innerHTML = cart.line_items.length;
        });

        if ($('body').hasClass('show-cart-preview')) {
            theme.cartPreview(cart);
        }
    });

    $('#nav-signin form').on('submit', function(e){
        e.preventDefault();

        var email = $(this).find('input[name=email]').val();
        var password = $(this).find('input[name=password]').val();
        var remember_me = $(this).find('input[name=remember_me]').prop('checked');

        var btn = Ladda.create(this.querySelector('button[type=submit]'));
        btn.start();

        Givecloud.Account.login(email, password, remember_me)
            .then(function(data) {
                top.location.href = data.redirect_to;
            }).catch(function(err) {
                theme.toast.error(err);
            }).finally(function() {
                 btn.stop();
            });
    });


    $('form[name=registerForm]').on('submit', function(e){
        e.preventDefault();

        if (!theme.bsFormValidate(this)) {
            return;
        }

        var btn = Ladda.create(this.querySelector('button[type=submit]'));
        var err = $(this).find('.alert-danger').hide();

        var data = {
            'account_type_id'      : $(this).find('select[name=account_type_id]').val(),
            'organization_name'    : $(this).find('input[name=organization_name]').val(),
            'donor_id'             : $(this).find('input[name=donor_id]').val(),
            'title'                : $(this).find('select[name=title]').val(),
            'first_name'           : $(this).find('input[name=first_name]').val(),
            'last_name'            : $(this).find('input[name=last_name]').val(),
            'email'                : $(this).find('input[name=email]').val(),
            'zip'                  : $(this).find('input[name=zip]').val(),
            'password'             : $(this).find('input[name=password]').val(),
            'email_opt_in'         : $(this).find('input[name=email_opt_in]:checked').val(),
            'g-recaptcha-response' : $(this).find('textarea[name=g-recaptcha-response]').val()
        };

        btn.start();

        Givecloud.Account.signup(data)
            .then(function(data) {
                top.location.href = data.redirect_to;
            }).catch(function(error) {
                grecaptcha.reset();
                err.html(theme.error(error)).show();
            }).finally(function() {
                 btn.stop();
            });
    });

    $('form[name=registerForm] select[name=account_type_id]').change(function(e) {
        var container = $('form[name=registerForm] input[name=organization_name]').parents('.form-group');
        container[$(this).find('option:selected').data('organization') ? 'show' : 'hide']();
    }).trigger('change');


    $('form[name=loginForm]').on('submit', function(e){
        e.preventDefault();

        if (!theme.bsFormValidate(this)) {
            return;
        }

        var btn = Ladda.create(this.querySelector('button[type=submit]'));
        var err = $(this).find('.alert-danger').hide();

        var data = {
            success_url    : $(this).find('input[name=success_url]').val(),
            email          : $(this).find('input[name=email]').val(),
            password       : $(this).find('input[name=password]').val()
        };

        btn.start();

        Givecloud.Account.login(data.email, data.password)
            .then(function(res) {
                top.location.href = data.success_url || res.redirect_to;
            }).catch(function(error) {
                btn.stop();
                err.html(theme.error(error)).show();
            });
    });


    $('form[name=resetPasswordForm]').on('submit', function(e){
        e.preventDefault();

        if (!theme.bsFormValidate(this)) {
            return;
        }

        var btn = Ladda.create(this.querySelector('button[type=submit]'));
        var msg = $(this).find('.alert-success').hide();
        var err = $(this).find('.alert-danger').hide();

        var data = {
            email: $(this).find('input[name=email]').val(),
        };

        btn.start();

        Givecloud.Account.resetPassword(data.email)
            .then(function(data) {
                msg.show();
            }).catch(function(error) {
                err.html(theme.error(error)).show();
            }).finally(function() {
                 btn.stop();
            });
    });

    $('form[action^="/ds/form/"]').on('submit', function(e) {
        e.preventDefault();
        var $form = $(this);
        function resetCaptcha() {
            var captchaType = Givecloud.config.captcha_type || 'recaptcha';
            if (captchaType === 'hcaptcha') {
                hcaptcha.reset();
            } else if (captchaType === 'recaptcha') {
                grecaptcha.reset();
            }
        }
        var $alert = $form.find('.alert').hide();
        if ($alert.length === 0) {
            $alert = $('<div class="alert">').hide().prependTo($form);
        }
        $.post($form.attr('action'), $form.gc_serializeArray())
            .done(function(res) {
                if (res.redirect_to) {
                    top.location.href = res.redirect_to;
                } else {
                    $form[0].reset();
                    resetCaptcha();
                    $alert.removeClass().addClass('alert alert-success').text(res.message).show();
                    theme.scrollIntoView($alert, 85);
                }
            }).fail(function(res) {
                if (res.redirect_to) {
                    top.location.href = res.redirect_to;
                } else {
                    resetCaptcha();
                    $alert.removeClass().addClass('alert alert-danger').text(res.responseJSON.message).show();
                    theme.scrollIntoView($alert, 85);
                }
            });
    });

    $('form[action="/ds/form/signup"] input[name="country"]').each(function() {
        var $input = $(this);
        Givecloud.Services.Locale.countries().then(function(data) {
            var countries = [];
            Givecloud.config.pinned_countries.forEach(function (code) {
                countries.push({
                    value: code,
                    label: data.countries[code] || code,
                });
                if (data.countries[code]) {
                    delete data.countries[code];
                }
            });
            if (countries.length) {
                countries.push({ value: '', label: '--------' });
            }
            Sugar.Object.forEach(data.countries, function(name, code) {
                countries.push({ value: code, label: name });
            });
            var $select = $('<select class="form-control" name="country"><option disabled selected>Country</option></select>');
            countries.forEach(function(country) {
                var $option = $('<option></option>');
                $option.attr('value', country.value).html(country.label);
                $select.append($option);
            });
            $input.replaceWith($select);
        });
    });

    $('form[name=changePasswordForm]').on('submit', function(e){
        e.preventDefault();

        if (!theme.bsFormValidate(this)) {
            return;
        }

        var btn = theme.ladda.start(this.querySelector('button[type=submit]'));
        var data = {
            password: $(this).find('input[name=password]').val(),
            password_confirmation: $(this).find('input[name=password_confirmation]').val(),
        };

        Givecloud.Account.changePassword(data)
            .then(function(data) {
                top.location.href = data.redirect_to;
            }).catch(function(error) {
                theme.toast.error(error);
            }).finally(function() {
                 btn.stop();
            });
    });


    /**
     * Initialize AniView
     * Animates elements into view as the user scrolls.
     */
    //$('.aniview').AniView();


    /**
     * Sidebar Nav
     * Functions that help manage the sidebar nav
     *
     * Usage
     * - Use the class `.side-bar` on the element you want to make a sidebar
     * - This JS will keep the side-bar full height
     * - Anything with the class .side-bar-open and .side-bar-close will open
     *   and close the sidebar
     * - A sidebar that is open will have the `.open` class added. By default
     *   a sidebar is closed (no .open class)
     */
    (function(){
        // control height
        function resizeSB(){
            $('.side-bar').height($(window).height()+'px');
        };
        resizeSB(); // initial resize
        $(window).on('resize', resizeSB); // anytime the page is resized

        // open/close
        $('.side-bar-open, .side-bar-close').on('click',function(){
            $('body').toggleClass('side-bar-open');
            $('.side-bar').toggleClass('open');
        });
    })();

    /**
     * Headroom (requires Headroom.js)
     * Expands/contracts headers based on scroll position.
     *
     * Usage
     * (Inspect accompanying CSS)
     */
    (function(){
        var h = new Headroom($('header').get(0),{
            'offset' : 100,
            'tolerance' : 10
        });
        h.init();
    })();

    /**
     * Adding Sponsorship to Cart
     * Find all forms where we're adding sponsorships to cart
     * and add the appropriate behaviour.
     *
     * Usage
     * - Give any form the class 'add-sponsorship-form' to
     *   processes sponsorship additions to cart
     */
    (function(){

        function onSubmit(ev){
            var $form = $(ev.target),
                $option = $form.find('input[name=payment_option_id]:checked'),
                data = {
                    'sponsorship_id'    : $form.find('input[name=sponsorship_id]').val(),
                    'payment_option_id' : $option.val(),
                    'payment_option_amount' : $option.parents('.btn').find('input[name=payment_option_amount]').val(),
                    'initial_charge'    : $form.find('input[name=initial_charge]:checked,input[name=initial_charge][type=hidden]').val()
                },
                submit_btn = Ladda.create($form.find('button[type=submit]')[0]),
                $opts = $form.find('.add-sponsorship-options,.add-sponsorship-btns'),
                $success = $form.find('.add-sponsorship-success');

            // stop default form behaviour
            ev.preventDefault();

            // loading button
            submit_btn.start();

            Givecloud.Cart().addSponsorship(data)
                .then(function(checkout){
                     $opts.slideUp();
                     $success.slideDown();
                })
                .catch(function(err){
                    theme.toast.error(err);
                    //theme.toast.error("Oh no! There was a problem. Can you try again?\n\nIf it still doesn't work, can you contact us and let us know right away?! Thank you!");
                }).finally(function(err){
                     submit_btn.stop();
                });
        }

        $('.add-sponsorship-form').bind('submit', onSubmit);
    })();

    /**
     * Carousel
     */
    $(".owl-carousel").each(function(i, el){
        var $el = $(el);
        var items = $el.data('items') || 5;

        if ($el.hasClass('owl-center-zoom')) {
            $el.owlCarousel({
                center: true,
                autoHeight: true,
                nav: false,
                loop: true,
                margin: 10,
                autoplay: true,
                autoplayTimeout: 6000,
                autoplayHoverPause: true,
                responsiveClass: true,
                responsive:{
                    0: {
                        items: Math.min(items, 1),
                        nav: true
                    },
                    640: {
                        items: Math.min(items, 3),
                        nav: true
                    },
                    992: {
                        items: Math.min(items, 3),
                        nav: true
                    },
                }
            });

        } else {
            $el.owlCarousel({
                nav: false,
                loop: true,
                margin: 30,
                autoplay: true,
                autoplayTimeout: 3000,
                autoplayHoverPause: true,
                responsiveClass: true,
                responsive:{
                    0: {
                        items: Math.min(items, 2),
                        nav: true
                    },
                    640: {
                        items: Math.min(items, 3),
                        nav: true
                    },
                    992: {
                        items: Math.min(items, 5),
                        nav: true
                    },
                }
            });
        }
    });

    /**
     * Date Picker
     */
    (function(){
        $('.date-picker').datepicker({
            format: 'M d, yyyy',
            autoclose: true
        }).on('show', function(event) {
            $(this).data('datepicker').picker.addClass('show');
        }).on('hide', function(event) {
            event.preventDefault();
            event.stopPropagation();
            $(this).data('datepicker').picker.removeClass('show');
        });
    }());

    /**
     * Cookie Notice
     */
    (function() {
        var $alert = jQuery('#cookie-alert');

        if (!$alert.length || Cookies.get('acceptCookies')) {
            return;
        }

        $alert.on('click', 'button', function() {
            $alert.removeClass('show');
            Cookies.set('acceptCookies', true, 60);
        }).show();

        setTimeout(function() {
            $alert.addClass('show');
        });
    })();

    /**
     * Pop-Up
     */
    (function() {
        $('[data-pop-up-id]').each(function(i,e){
            var $pop      = $(e),
                pop_id    = "gc_popup_" + ($pop.data('pop-up-id') || 'mypopup').replace(/[^0-9a-zA-Z]/g, ''),
                pop_delay = parseInt($(e).data('pop-up-delay') || 0) * 1000;

            if (Cookies.get(pop_id)) {
                return;
            }

            $pop.modal({
                'backdrop':'static',
                'show':false
            })
            .on('click', '.close-pop-up', function(ev) {
                ev.preventDefault();
                Cookies.set(pop_id, true, 60);
                if ($(this).attr('href')) {
                    window.location = $(this).attr('href');
                }
                $(this).modal('hide');
            })
            .on('hidden.bs.modal', function(ev) {
                Cookies.set(pop_id, true, 60);
                $(this).modal('dispose');
            });

            setTimeout(function(){
                $pop.modal('show');
            }, pop_delay);
        });
    })();

    /**
     * Image options
     */
    $.imageOptions();

    /**
     * NPS capture
     */
    $('form[name=capture-nps]').on('submit', function(ev){
        ev.preventDefault();

        var $form = $(this),
            nps = $form.find('input[name=nps]:checked').val(),
            btn = Ladda.create(this.querySelector('button[type=submit]'));

        if (isNaN(parseInt(nps))) {
            return theme.toast.error("Choose a number!");
        }

        btn.start();

        Givecloud.Account.update({ nps: nps })
            .then(function() {
                $('.capture-nps-wrap').remove();
                theme.toast.success("Thank you for the feedback!");
            }).catch(function(err) {
                theme.toast.error(err);
            }).finally(function() {
                btn.stop();
            });
    });
});

$.imageOptions = function(){
    var onChoose = function(target){
        $(target).find('input[type=radio]').prop('checked',true);
        $(target).parents('.image-options').first().find('.image-option').removeClass('image-option-selected');
        $(target).addClass('image-option-selected');
    }

    $('.image-option').on('click', function(ev){ onChoose(ev.target); });

    $('.image-option-input').each(function(i, el){
        var $el = $(el),
            $label = $('label[for='+$el.attr('id')+']');

        var _showImage = function (src) {
            var fr = new FileReader();
            fr.onload = function(e) {
                $option = $label.parents('.image-option-custom');
                $option.css('background-image', "url('"+this.result+"')");
                onChoose($option);
            };
            src.addEventListener("change",function() {
                if (src.files.length > 0) {
                    fr.readAsDataURL(src.files[0]);
                }
            });
        };

        if ($el.data('selected-image')) {
            $label.parents('.image-option-custom').css('background-image', "url('"+$el.data('selected-image')+"')");
        }

        _showImage(el);
    });

    if ($('.image-option input[type=radio]:checked').length > 0) {
        $('.image-option input[type=radio]:checked').first().parent().click();
    } else {
        $('.image-option').first().click();
    }
}


jQuery.fn.gc_serializeArray = function() {
    var fields = jQuery.fn.serializeArray.apply(this);
    jQuery.each(this.find('input'), function (i, element) {
        if (element.type == 'checkbox' && !element.checked) {
            fields.push({ name: element.name, value: '' })
        }
    });
    return fields;
};


theme.modal = function(settings) {
    var opts = jQuery.extend({}, {
            id: 'themeModal-' + Math.floor((Math.random() * 100000) + 1),
            title: 'Loading...',
            class: '',
            body: '<div style="padding:20px; text-align:center;"><i class="fa fa-spinner fa-spin"></i></div>',
            buttons: [
                '<button type="button" class="btn btn-light" data-dismiss="modal">Close</button>'
            ],
            backdrop: true,
            onOpen: null,
            size: 'lg'
        }, settings);

    var $modal = $('<div id="' + opts.id + '" class="modal fade ' + opts.class + '" tabindex="-1" role="dialog">' +
            '<div class="modal-dialog modal-' + opts.size + '" role="document">' +
                '<div class="modal-content">' +
                    '<div class="modal-header">' +
                        '<h4 class="modal-title">'+ opts.title +'</h4>' +
                        '<button type="button" class="close" data-dismiss="modal" aria-label="Close"><span aria-hidden="true">&times;</span></button>' +
                    '</div>' +
                    '<div class="modal-body">' +
                        opts.body +
                    '</div>' +
                    '<div class="modal-footer">' +
                        opts.buttons.join('') +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</div>');

    $('body').append($modal);

    $modal.on('hidden.bs.modal', function () {
        $modal.remove();
    });

    $modal.on('show.bs.modal', function (ev) {
        $modal.find('.modal-dialog').velocity('callout.tada', {duration:300});
    });

    $modal.on('shown.bs.modal', function (ev) {
        $modal.find('[autofocus]').first().focus();
        if (typeof opts.onOpen === 'function') opts.onOpen($modal);
    });

    $modal.modal({
        backdrop: opts.backdrop
    });

    if (opts.backdropColour) {
        $modal.data('bs.modal')._backdrop.style.background = opts.backdropColour;
    }

    return $modal;
}


theme.alert = function(message, modalClass, icon, backdropColour){
    if (typeof modalClass === 'undefined') modalClass = 'light';
    if (typeof icon === 'undefined') icon = 'fa-question-circle';

    if (!backdropColour) {
        if (modalClass === 'danger') backdropColour = '#690202';
        if (modalClass === 'warning') backdropColour = '#fcf8e3';
    }

    return theme.modal({
        class: 'modal-' + modalClass,
        size: 'sm',
        body: message,
        title: '<i class="fa ' + icon + '"></i> Alert',
        buttons: [
            '<button type="button" class="btn btn-light" data-dismiss="modal"><i class="fa fa-times"></i> Close</button>'
        ],
        backdropColour: backdropColour || '#690202'
    });
};


theme.confirm = function(message, action, modalClass, icon, backdropColour) {
    if (typeof modalClass === 'undefined') modalClass = 'light';
    if (typeof icon === 'undefined') icon = 'fa-question-circle';

    if (!backdropColour) {
        if (modalClass === 'danger') backdropColour = '#690202';
        if (modalClass === 'warning') backdropColour = '#fcf8e3';
    }

    return theme.modal({
        class: 'modal-' + modalClass,
        size: 'sm',
        body: message,
        title: '<i class="fa ' + icon + '"></i> Confirm',
        buttons: [
            '<button type="button" class="btn btn-' + modalClass + ' confirm-do" data-dismiss="modal"><i class="fa fa-check"></i> Yes</button>',
            '<button type="button" class="btn btn-light" data-dismiss="modal"><i class="fa fa-times"></i> No</button>'
        ],
        backdropColour: backdropColour,
        onOpen: function (element) {
            if (typeof action === 'function') {
                jQuery(element).find('.confirm-do').click(function(e) {
                    action(modal);
                });
            }
        }
    });
};

theme.fundraiserOnAccountTypeChange = function(element) {
    var $accountType = jQuery(element);
    var $organizationName = $accountType.parents('.modal-body').find('input[name=organization_name]').parents('.form-group');
    if ($accountType.find('option:selected').data('organization')) {
        $organizationName.show().attr('required', true);
    } else {
        $organizationName.hide().removeAttr('required');
    }
};
