
theme.PaymentMethods = (function(t){

    function PaymentMethodComponent(selector) {
        this.selector = selector;

        function updateInput(payment_method) {
            return {
                payment_type:           t.data_get(payment_method, 'payment_type', Givecloud.Gateway.getDefaultPaymentType()),
                display_name:           t.data_get(payment_method, 'display_name'),
                billing_title:          t.data_get(payment_method, 'billing_address.title'),
                billing_first_name:     t.data_get(payment_method, 'billing_address.first_name'),
                billing_last_name:      t.data_get(payment_method, 'billing_address.last_name'),
                billing_email:          t.data_get(payment_method, 'billing_address.email'),
                billing_address1:       t.data_get(payment_method, 'billing_address.address1'),
                billing_address2:       t.data_get(payment_method, 'billing_address.address2'),
                billing_company:        t.data_get(payment_method, 'billing_address.company'),
                billing_city:           t.data_get(payment_method, 'billing_address.city'),
                billing_province_code:  t.data_get(payment_method, 'billing_address.province_code'),
                billing_zip:            t.data_get(payment_method, 'billing_address.zip'),
                billing_country_code:   t.data_get(payment_method, 'billing_address.country_code'),
                billing_phone:          t.data_get(payment_method, 'billing_address.phone'),
            };
        }

        this.vm = new Vue({
            el: this.selector,
            delimiters: ['${', '}'],
            data: {
                payment_method: null,
                billing_province_label: 'State',
                input: updateInput(),
                payment: {},
                formValidated: false,
                overlayTimer: null,
                subscription_ids: [],
                use_as_default: false
            },
            mounted: function() {
                var self = this;
                this.payment_method = JSON.parse(this.$el.attributes['payment-method'].value);

                if (!this.payment_method.id) {
                    this.use_as_default = true;
                    this.payment.name = this.account.display_name;
                }

                if (this.payment_method.subscriptions.length > 0) {
                    this.payment_method.subscriptions.forEach(function(subscription) {
                        self.subscription_ids.push(sub.id);
                    });
                } else {
                    this.account.subscriptions.forEach(function(subscription) {
                        if (subscription.status === 'active') {
                            self.subscription_ids.push(subscription.id);
                        }
                    });
                }
            },
            watch: {
                payment_method: function(payment_method) {
                    this.input = updateInput(payment_method);
                },
                'input.billing_country_code': function(new_value, old_value) {
                    if (new_value !== old_value) {
                        this.input.billing_province_code = null;
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
                        this.payment.payment_method = theme.data_get(this.cart, 'account.payment_methods.0.id');
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
                }
            },
            computed: {
                config: function() {
                    return Givecloud.config;
                },
                account: function() {
                    return Givecloud.config.account;
                },
                subscriptions: function() {
                    if (this.account) {
                        return this.account.subscriptions.filter(function(subscription) {
                            return !subscription.locked && subscription.status !== 'cancelled';
                        });
                    }
                    return [];
                },
                gocardless_available: function() {
                    if (Givecloud.config.gateways.bank_account === 'gocardless') {
                        return true;
                    }
                },
                paypal_available: function() {
                    var gateway = Givecloud.PaymentTypeGateway('paypal');
                    if (gateway && gateway.referenceTransactions) {
                        return true;
                    }
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
                }
            },
            methods: {
                money: function(value, currency) {
                    return (currency || Givecloud.config.currency).symbol + theme.formatNumber(value);
                },
                supportedCardType: function(type) {
                    return Givecloud.config.supported_cardtypes.indexOf(type) !== -1;
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
                    var modal = $('#payment-overlay').modal({
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
                        // avoid displaying modal for quick transactions
                        this.overlayTimer = setTimeout(t.arrow(this, function() {
                            this.overlayTimer = null;
                            modal.show();
                        }), 250);
                    }
                },
                submitPaymentMethodForm: function(event) {
                    this.formValidated = true;
                    this.$validator.validateAll()
                        .bind(this)
                        .then(function(valid) {
                            if (!valid) {
                                return Promise.reject();
                            }
                            this.paymentOverlay();
                            return Givecloud.Account.PaymentMethods.create(this.input)
                                .bind(this)
                                .then(function(payment_method) {
                                    payment_method.payment_type = this.input.payment_type;
                                    this.payment_method = payment_method;
                                    this.payment.name = this.payment.name || this.payment_method.billing_address.name;
                                    this.payment.address_line1 = this.payment_method.billing_address.address1;
                                    this.payment.address_line2 = this.payment_method.billing_address.address2;
                                    this.payment.address_city = this.payment_method.billing_address.city;
                                    this.payment.address_state = this.payment_method.billing_address.province_code;
                                    this.payment.address_zip = this.payment_method.billing_address.zip;
                                    this.payment.address_country = this.payment_method.billing_address.country_code;
                                    return Givecloud.Account.PaymentMethods.tokenize(this.payment_method, this.payment, this.input.payment_type);
                                });
                        }).then(function(res) {
                            if (this.use_as_default) {
                                return Givecloud.Account.PaymentMethods.setDefault(this.payment_method.id);
                            } else {
                                return Promise.resolve();
                            }
                        }).then(function(res) {
                            if (this.subscription_ids.length > 0) {
                                return Givecloud.Account.PaymentMethods.useForSubscriptions(this.payment_method.id, this.subscription_ids);
                            } else {
                                return Promise.resolve();
                            }
                        }).then(function(res) {
                            window.location.href = '/account/payment-methods';
                        }).catch(function(err) {
                            theme.toast.error(err);
                        }).finally(function() {
                            this.paymentOverlay('hide');
                        });
                }
            },
            filters: {
                downcase: function(value) {
                    return typeof value === 'string' ? value.toLowerCase() : '';
                }
            }
        });
    }


    if (document.querySelectorAll('#payment-methods-app').length) {
        new PaymentMethodComponent('#payment-methods-app');
    }

    return {
        setDefault: function(el, id){
            var btn = Ladda.create(el);
            btn.start();

            Givecloud.Account.PaymentMethods.setDefault(id)
                .then(function(){
                    window.location.href = '/account/payment-methods';
                }).catch(function(err) {
                    theme.toast.error(err);
                }).finally(function() {
                    btn.stop();
                });
        },
        remove: function(el, id){
            var btn = Ladda.create(el);
            btn.start();

            Givecloud.Account.PaymentMethods.remove(id)
                .then(function(){
                    window.location.href = '/account/payment-methods';
                }).catch(function(err) {
                    theme.toast.error(err);
                }).finally(function() {
                    btn.stop();
                });
        }
    };

})(theme);
