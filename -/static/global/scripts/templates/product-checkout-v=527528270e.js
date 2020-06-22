
theme.productCheckout = (function(t){

    function ProductCheckoutComponent(selector) {
        this.vm = new Vue({
            el: selector,
            delimiters: ['${', '}'],
            data: {
                amt: 0,
                billing_period: 'onetime',
                billing_province_label: 'State',
                recurring_with_initial_charge: false,
                cart: null,
                account: null,
                input: {
                    account_type_id: 1,
                    currency_code: Givecloud.config.currency.code,
                    payment_type: Givecloud.Gateway.getDefaultPaymentType(),
                    billing_title: null,
                    billing_first_name: null,
                    billing_last_name: null,
                    billing_company: null,
                    billing_email: null,
                    email_opt_in: false,
                    billing_address1: null,
                    billing_address2: null,
                    billing_city: null,
                    billing_province_code: null,
                    billing_zip: null,
                    billing_country_code: Givecloud.config.billing_country_code,
                    billing_phone: null,
                    cover_fees: Givecloud.config.processing_fees.cover,
                    is_anonymous: false,
                    comments: ''
                },
                payment: {
                    currency: Givecloud.config.currency.code,
                },
                payValidated: false,
                overlayTimer: null,
                referral_source: null,
                requires_captcha: Givecloud.config.requires_captcha,
                redirect_url: null,
                gift_aid: false,
            },
            mounted: function(){
                var self = this;

                theme.product.init(this.$el);

                $(this.$el).find('input[name=amt]').change(function(event){
                    self.amt = parseFloat(event.target.value, 10) || 0;
                }).change();

                $(this.$el).find('input[name=recurring_frequency]').change(function(event){
                    self.billing_period = event.target.value || 'onetime';
                }).change();

                $(this.$el).find('input[name=recurring_with_initial_charge]').change(function(event){
                    self.recurring_with_initial_charge = (event.target.type === 'hidden')
                        ? event.target.value : event.target.checked;
                }).change();

                if (!this.$refs.cover_fees || $(this.$refs.cover_fees).data('state') === 'unchecked') {
                    this.input.cover_fees = false;
                }

                if (this.$refs.referral_source) {
                    this.input.referral_source = this.$refs.referral_source.value;
                }
                if (this.$refs.redirect_url) {
                    this.redirect_url = this.$refs.redirect_url.value;
                }

                $(document).on('gc-number-type', function(event){
                    self.$set(self.payment, 'number_type', event.detail);
                });
            },
            watch: {
                referral_source: function(new_value, old_value) {
                    var self = this;
                    if (new_value !== old_value) {
                        if (new_value === 'other') {
                            this.input.referral_source = null;
                            this.$nextTick(function(){
                                self.$refs.referral_source_other.focus();
                            });
                        } else {
                            this.input.referral_source = new_value;
                        }
                    }
                },
                'input.currency_code': function(new_value, old_value) {
                    if (new_value !== old_value) {
                        this.payment.currency = new_value;
                        jQuery(this.$refs.productOptionForm).find('input[name=variant_id]').first().change();
                        jQuery('body').removeClass(function (index, css) {
                            return (css.match(/\bcurrency-\S+/g) || []).join(' ');
                        });
                        jQuery('body').addClass(('currency-' + new_value).toLowerCase());
                    }
                },
                'input.payment_type': function(new_value, old_value) {
                    if (new_value !== 'credit_card') {
                        delete this.payment.number;
                        delete this.payment.number_type;
                        delete this.payment.cvv;
                        delete this.payment.exp;
                        delete this.payment.save_payment_method;
                    }
                    if (new_value !== 'bank_account') {
                        delete this.payment.account_holder_type;
                        delete this.payment.account_type;
                        delete this.payment.routing_number;
                        delete this.payment.account_number;
                        delete this.payment.ach_agree_tos;
                        delete this.payment.save_payment_method;
                    }
                    if (new_value !== 'paypal') {
                        delete this.payment.save_payment_method;
                    }
                    if (new_value === 'payment_method' && !this.payment.payment_method) {
                        this.payment.payment_method = t.data_get(this.account, 'payment_methods.0.id');
                    } else {
                        delete this.payment.payment_method;
                    }
                },
                'payment.number': function(new_value, old_value) {
                    if (new_value !== old_value) {
                        this.payment.number_type = Givecloud.CardholderData.getNumberType(new_value);
                    }
                },
                'payment.exp': function(new_value, old_value) {
                    if (new_value !== old_value && new_value > 1) {
                        if (new_value.length === 1) {
                            this.payment.exp = '0' + new_value + ' / ';
                        }
                        if (new_value.length === 2) {
                            this.payment.exp = new_value + ' / ';
                        }
                    }
                },
            },
            computed: {
                account_type: function() {
                    return this.account_types[this.input.account_type_id];
                },
                account_types: function() {
                    var types = {};
                    Givecloud.config.account_types.forEach(function(type) {
                        types[type.id] = type;
                    });
                    return types;
                },
                config: function() {
                    return Givecloud.config;
                },
                currency: function() {
                    var data = {
                        code: this.input.currency_code,
                        symbol: Givecloud.config.currency.symbol,
                    };
                    this.currencies.forEach(function(currency) {
                        if (currency.code === data.code) {
                            data.symbol = currency.symbol;
                        }
                    });
                    return data;
                },
                currencies: function() {
                    return Givecloud.config.currencies;
                },
                donor_title_options: function() {
                    return Givecloud.config.title_options;
                },
                fees: function() {
                    var fees = Givecloud.config.processing_fees;
                    return Sugar.Number.round(fees.amount + (this.amt * fees.rate / 100), 2);
                },
                gateway: function() {
                    return Givecloud.PaymentTypeGateway(this.input.payment_type);
                },
                gocardless_available: function() {
                    if (Givecloud.config.gateways.bank_account === 'gocardless') {
                        return true;
                    }
                },
                paypal_available: function() {
                    var gateway = Givecloud.PaymentTypeGateway('paypal');
                    if (gateway && (this.is_onetime || gateway.referenceTransactions)) {
                        return true;
                    }
                },
                paysafe_checkout_available: function() {
                    var gateway = Givecloud.PaymentTypeGateway('credit_card');
                    if (Givecloud.config.gateways.credit_card === 'paysafe' && gateway.useCheckout) {
                        if (this.is_onetime || this.recurring_with_initial_charge) {
                            return this.total_amt > 0;
                        }
                    }
                },
                is_onetime: function() {
                    return this.billing_period === 'onetime';
                },
                referral_sources: function() {
                    return Givecloud.config.referral_sources;
                },
                total_amt: function() {
                    if (this.input.cover_fees) {
                        return Sugar.Number.round(this.amt + this.fees, 2);
                    }
                    return this.amt;
                },
                billing_province_required: function() {
                    if (this.billing_subdivisions && Object.keys(this.billing_subdivisions).length) return 'required';
                },
                unsupported_card_type: function() {
                    return this.payment.number_type && !this.supportedCardType(this.payment.number_type);
                },
            },
            asyncComputed: {
                countries: {
                    get: function() {
                        return Givecloud.Services.Locale.countries().then(function(data) {
                            var countries = [];
                            if (Givecloud.config.force_country) {
                                countries.push({
                                    value: Givecloud.config.force_country,
                                    label: data.countries[Givecloud.config.force_country] || Givecloud.config.force_country,
                                });
                            } else {
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
                            }
                            return Promise.resolve(countries);
                        });
                    },
                    default: {}
                },
                billing_subdivisions: {
                    get: function() {
                        return Givecloud.Services.Locale.subdivisions(this.input.billing_country_code)
                            .bind(this)
                            .then(function(data) {
                                if (Sugar.Object.size(data.subdivisions)) {
                                    this.billing_province_label = data.subdivision_type;
                                    return Promise.resolve(data.subdivisions);
                                } else {
                                    return Promise.resolve(null);
                                }
                            });
                    },
                    default: null
                },
            },
            methods: {
                money: function(value, includeCode) {
                    var value = this.currency.symbol + theme.formatNumber(theme.toNumber(value, 0));
                    if (includeCode && this.currencies.length > 1) {
                        return value + ' ' + this.currency.code;
                    } else {
                        return value;
                    }
                },
                supportedCardType: function(type) {
                    return Givecloud.config.supported_cardtypes.indexOf(type) !== -1;
                },
                supportedPaymentType: function(type) {
                    if (type !== 'bank_account' && t.data_get(this.cart, 'requires_ach')) {
                        return false;
                    }
                    return Givecloud.config.gateways[type];
                },
                paymentExpiry: function(event) {
                    if (event.isTrusted && event.target === document.activeElement) {
                        setTimeout(function() {
                            var position = event.target.value.length;
                            event.target.setSelectionRange(position, position);
                        },60);
                    }
                },
                paymentOverlay: function(status) {
                    var $modal = $('#payment-overlay'),
                        modal = $modal.modal({
                        backdrop: 'static',
                        keyboard: false,
                        show: false
                    }).data('bs.modal');
                    if (status === 'hide') {
                        if (this.overlayTimer) {
                            clearTimeout(this.overlayTimer);
                            this.overlayTimer = null;
                        } else {
                            // bootstrap won't hide the modal if it's transitioning
                            modal._isTransitioning = false;
                            modal.hide();
                        }
                    } else {
                        $modal.find('.spinner').addClass('d-none');

                        if (status === 'success') {
                            $modal.find('.spinner-success').removeClass('d-none');
                        } else {
                            $modal.find('.spinner-spin').removeClass('d-none');
                        }

                        // avoid displaying modal for quick transactions
                        this.overlayTimer = setTimeout(t.arrow(this, function() {
                            this.overlayTimer = null;
                            modal.show();
                        }), 250);
                    }
                },
                scrollToError: function() {
                    t.scrollIntoView(this.$el.querySelector('.has-errors,input:invalid'), 85).then(function(element){
                        element.find(':input').focus();
                    });
                },
                validatePayForm: function(showErrors) {
                    if (showErrors === void 0 || showErrors) {
                        this.payValidated = true;
                    }
                    if (t.bsFormValidate(this.$refs.form) === false) {
                        this.scrollToError();
                        this.$validator.validateAll('pay');
                        return Promise.reject();
                    }
                    return this.$validator.validateAll('pay')
                        .bind(this)
                        .then(function(valid) {
                            if (this.payment.number_type && !this.supportedCardType(this.payment.number_type)) {
                                return Promise.reject('Unsupport card type. Please try again with a different card.');
                            }
                            if (!valid) {
                                this.scrollToError();
                                return Promise.reject();
                            } else {
                                return Promise.resolve();
                            }
                        });
                },
                submitPayForm: function() {
                    this.validatePayForm()
                        .bind(this)
                        .then(function() {
                            this.input.item = {form_fields: {}};
                            this.input.cover_costs_enabled = this.input.cover_fees;
                            $([this.$refs.productOptionForm, this.$refs.productForm]).find(':input')
                                .serializeArray()
                                .forEach(t.arrow(this, function(field){
                                    t.data_set(this.input.item, field.name, field.value);
                                }));

                            this.input.item.amt = this.amt;
                            this.input.item.gift_aid = this.gift_aid;

                            this.paymentOverlay();
                            theme.ladda.start('#btn-pay');

                            Givecloud.Cart.oneClickCheckout(this.input, this.cart, this.input.payment_type)
                                .bind(this)
                                .then(function(data){
                                    this.cart = data.cart;
                                    this.account = this.cart.account;
                                    if (this.cart.requires_payment) {
                                        this.payment.name = this.cart.billing_address.name;
                                        this.payment.address_line1 = this.cart.billing_address.address1;
                                        this.payment.address_line2 = this.cart.billing_address.address2;
                                        this.payment.address_city = this.cart.billing_address.city;
                                        this.payment.address_state = this.cart.billing_address.province_code;
                                        this.payment.address_zip = this.cart.billing_address.zip;
                                        this.payment.address_country = this.cart.billing_address.country_code;
                                        return this.gateway.getCaptureToken(this.cart, this.payment, this.input.payment_type, this.input.recaptcha_response, this.payment.save_payment_method)
                                            .bind(this)
                                            .then(function(token) {
                                                return this.gateway.chargeCaptureToken(this.cart, token);
                                            });
                                    }
                                    return Givecloud.Cart(this.cart.id).complete();
                                }).then(function(res) {
                                    this.paymentOverlay('success');
                                    setTimeout(t.arrow(this, function() {
                                        if (this.redirect_url) {
                                            window.location.href = this.redirect_url;
                                        } else {
                                            window.location.href = '/order/' + this.cart.id + '/thank-you';
                                        }
                                    }),1000);
                                }).catch(function(err) {
                                    if (err) {
                                        if (theme.data_get(err, 'data.cart')) {
                                            this.cart = theme.data_get(err, 'data.cart');
                                        }
                                        if (theme.data_get(err, 'data.captcha')) {
                                            if (this.requires_captcha) {
                                                this.$refs.recaptcha.reset();
                                            } else {
                                                this.requires_captcha = true;
                                            }
                                        }
                                        theme.toast.error(err);
                                    }
                                    this.paymentOverlay('hide');
                                    theme.ladda.stop('#btn-pay');
                                });
                        }).catch(function(err) {
                            if (err) {
                                theme.toast.error(err);
                            }
                        });
                }
            },
            filters: {
                ordinal: function(value) {
                    value = parseInt(value);
                    if (value) {
                        return Sugar.Number.ordinalize(value);
                    }
                },
                size: function(value) {
                    return Sugar.Object.size(value);
                }
            }
        });

        if (Givecloud.config.account_id) {
            Givecloud.Account.get().then(t.arrow(this.vm, function(data) {
                // this needs to happen in the next tick to avoid validation issues
                // https://github.com/baianat/vee-validate/issues/2109
                this.$nextTick(t.arrow(this, function() {
                    this.account = data.account;
                    if (data.account.payment_methods.length) {
                        this.input.payment_type = 'payment_method'
                    }
                }));

                this.input.billing_title         = t.data_get(data.account, 'billing_address.title');
                this.input.billing_first_name    = t.data_get(data.account, 'billing_address.first_name', t.data_get(data.account, 'first_name'));
                this.input.billing_last_name     = t.data_get(data.account, 'billing_address.last_name', t.data_get(data.account, 'last_name'));
                this.input.billing_email         = t.data_get(data.account, 'billing_address.email', t.data_get(data.account, 'email'));
                this.input.billing_address1      = t.data_get(data.account, 'billing_address.address1');
                this.input.billing_address2      = t.data_get(data.account, 'billing_address.address2');
                this.input.billing_company       = t.data_get(data.account, 'billing_address.company');
                this.input.billing_city          = t.data_get(data.account, 'billing_address.city');
                this.input.billing_province_code = t.data_get(data.account, 'billing_address.province_code');
                this.input.billing_country_code  = t.data_get(data.account, 'billing_address.country_code', Givecloud.config.billing_country_code);
                this.input.billing_zip           = t.data_get(data.account, 'billing_address.zip');
                this.input.billing_phone         = t.data_get(data.account, 'billing_address.phone');
            })).catch(t.noop);
        }
    }

    if (document.querySelectorAll('#product-payment-app').length) {
        return new ProductCheckoutComponent('#product-payment-app');
    }

})(theme);
