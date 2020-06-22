
theme.cart = (function(){

    function arrow(context, fn) {
        return fn.bind(context);
    }

    function CartComponent(selector, cart_id) {
        this.cart_id = cart_id;
        this.selector = selector;

        Givecloud.Cart(cart_id).get().then(this.initialize.bind(this));
    }

    CartComponent.prototype.initialize = function(cart) {
        if (this.vm) {
            throw new Error("Cart has already been initialized.");
        }

        var step = 1;
        switch (window.location.hash) {
            case '#/basket':   step = 1; break;
            case '#/address':  step = 2; break;
            case '#/shipping': step = 3; break;
            case '#/payment':  step = 4; break;
        }

        function updateInput(cart) {
            return {
                comments:               cart.comments,
                referral_source:        cart.referral_source,
                ship_to_billing:        cart.ship_to_billing,
                account_type_id:        cart.account_type_id || 1,
                billing_title:          cart.billing_address.title,
                billing_first_name:     cart.billing_address.first_name,
                billing_last_name:      cart.billing_address.last_name,
                billing_email:          cart.billing_address.email,
                billing_address1:       cart.billing_address.address1,
                billing_address2:       cart.billing_address.address2,
                billing_company:        cart.billing_address.company,
                billing_city:           cart.billing_address.city,
                billing_province_code:  cart.billing_address.province_code,
                billing_zip:            cart.billing_address.zip,
                billing_country_code:   cart.billing_address.country_code,
                billing_phone:          cart.billing_address.phone,
                shipping_title:         cart.shipping_address.title,
                shipping_first_name:    cart.shipping_address.first_name,
                shipping_last_name:     cart.shipping_address.last_name,
                shipping_email:         cart.shipping_address.email,
                shipping_address1:      cart.shipping_address.address1,
                shipping_address2:      cart.shipping_address.address2,
                shipping_company:       cart.shipping_address.company,
                shipping_city:          cart.shipping_address.city,
                shipping_province_code: cart.shipping_address.province_code,
                shipping_zip:           cart.shipping_address.zip,
                shipping_country_code:  cart.shipping_address.country_code,
                shipping_phone:         cart.shipping_address.phone,
                shipping_method_value:  cart.shipping_method_value,
                email_opt_in:           cart.email_opt_in,
                payment_type:           Givecloud.Gateway.getDefaultPaymentType(cart),
                requires_captcha:       cart.requires_captcha || false
            };
        }

        this.vm = new Vue({
            el: this.selector,
            delimiters: ['${', '}'],
            data: {
                cart: cart,
                input: updateInput(cart),
                can_cover_costs: false,
                isUpdatingCart: false,
                billing_province_label: 'State',
                shipping_province_label: 'State',
                payment: {
                    currency: Givecloud.config.currency.code,
                    payment_method: theme.data_get(cart, 'account.payment_methods.0.id')
                },
                step: step,
                checkoutValidated: false,
                shipValidated: false,
                payValidated: false,
                overlayTimer: null,
                promocode: null,
                referral_source: null,
                requiresCaptcha: theme.data_get(cart, 'requires_captcha')
            },
            mounted: function () {
                this.can_cover_costs = parseInt(this.$el.attributes['can-cover-costs'].value, 0) ? true : false;
            },
            watch: {
                cart: function(cart) {
                    this.input = updateInput(cart);
                },
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
                'input.billing_country_code': function(new_value, old_value) {
                    if (new_value !== old_value) {
                        this.input.billing_province_code = null;
                    }
                },
                'input.shipping_country_code': function(new_value, old_value) {
                    if (new_value !== old_value) {
                        this.input.shipping_province_code = null;
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
                valid_cart: function() {
                    return this.cart.line_items.length > 0;
                },
                valid_checkout: function() {
                    var invalid = Sugar.Object.count(this.$validator.flags, function(field) {
                        return !field.valid;
                    });
                    return !invalid;
                },
                valid_shipping: function() {
                    if (this.cart.requires_shipping) {
                        return this.cart.shipping_method || this.cart.eligible_for_free_shipping;
                    }
                    return true;
                },
                show_cover_costs: function () {
                    if (!this.can_cover_costs || !this.cart) {
                        return false;
                    }
                    return this.cart.line_items.filter(function (item) {
                        return item.cover_costs_enabled ? true : false;
                    }).length ? true : false;
                },
                ready_for_payment: function() {
                    try {
                        Givecloud.CardholderData.forCreditCard(this.payment);
                        return true;
                    } catch (err) {
                        return false;
                    }
                },
                referral_sources: function() {
                    return Givecloud.config.referral_sources;
                },
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
                donor_title_options: function() {
                    return Givecloud.config.title_options;
                },
                recurring_items: function() {
                    return this.cart.line_items.filter(function(item) {
                        return item.recurring_amount > 0;
                    });
                },
                recurring_amounts: function() {
                    var amounts = {
                        day: 0,
                        week: 0,
                        bimonthly: 0,
                        monthly: 0,
                        quarterly: 0,
                        biannually: 0,
                        annually: 0
                    };
                    this.recurring_items.forEach(function(item) {
                        amounts[item.recurring_frequency] += item.recurring_amount + item.cover_costs_recurring_amount;
                    });
                    return amounts;
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
                        return this.cart.total_price > 0;
                    }
                },
                is_onetime: function() {
                    return !this.recurring_items.length;
                },
                billing_province_required: function() {
                    if (this.billing_subdivisions && Object.keys(this.billing_subdivisions).length) return 'required';
                },
                shipping_province_required: function() {
                    if (this.shipping_subdivisions && Object.keys(this.shipping_subdivisions).length) return 'required';
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
                shipping_subdivisions: {
                    get: function() {
                        return Givecloud.Services.Locale.subdivisions(this.input.shipping_country_code)
                            .bind(this)
                            .then(function(data) {
                                if (Sugar.Object.size(data.subdivisions)) {
                                    this.shipping_province_label = data.subdivision_type;
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
                money: function(value, includeCode) {
                    var amount = this.cart.currency.symbol + theme.formatNumber(value);
                    if (includeCode && Givecloud.config.currencies.length > 1) {
                        return amount + this.cart.currency.code;
                    } else {
                        return amount;
                    }
                },
                setStep: function(step) {
                    this.step = step;
                },
                updateQuantity: function(item) {
                    var data = { quantity: item.quantity };
                    Givecloud.Cart(this.cart.id).updateItem(item.id, data)
                        .then(function(){
                            if (data.quantity) {
                                theme.toast.success('Item quantity updated.');
                            } else {
                                theme.toast.success('Item removed from your cart.');
                            }
                        })
                        .catch(function(){
                            if (item.quantity === 0) {
                                theme.toast.error('Error removing item from cart.');
                            } else if (item.quantity > 1 && item.is_donation) {
                                theme.toast.error("The quantity of a donation item can't be greater than one.");
                            } else {
                                theme.toast.error('Error updating item quantity in cart.');
                            }
                        });
                },
                updateCoverCosts: function () {
                    if (this.cart.id) {
                        this.isUpdatingCart = true;
                        return Givecloud.Cart(this.cart.id).updateDcc(!this.cart.cover_costs_enabled).bind(this).then(function (result) {
                            this.cart = result.cart;
                        }).finally(function () {
                            this.isUpdatingCart = false;
                            return Promise.resolve();
                        });
                    }
                },
                removeItem: function(item) {
                    Givecloud.Cart(this.cart.id).removeItem(item.id)
                        .then(function(){
                            theme.toast.success('Item removed from cart.');
                        })
                        .catch(function(){
                            theme.toast.error('Error removing item from cart.');
                        });
                },
                applyPromo:function () {
                    Givecloud.Cart(this.cart.id).addDiscount(this.promocode)
                        .then(function(){
                            theme.toast.success('Discount applied!');
                        }).catch(function(err){
                            theme.toast.error(err);
                        });
                },
                proceedToCheckout: function() {
                    if (this.cart.comments !== this.input.comments) {
                        var btn = Ladda.create(document.getElementById('btn-step-1-next'));
                        btn.start();

                        Givecloud.Cart(this.cart.id).update({
                                'comments' : this.input.comments
                            })
                            .bind(this)
                            .then(function() {
                                this.step = 2;
                                theme.toast.success('Comments saved.');
                            })
                            .catch(function(err){
                                theme.toast.error(err);
                            }).then(function(){
                                btn.stop();
                            });
                    } else {
                        this.step = 2;
                    }
                },
                supportedCardType: function(type) {
                    return Givecloud.config.supported_cardtypes.indexOf(type) !== -1;
                },
                supportedPaymentType: function(type) {
                    if (type !== 'bank_account' && this.cart.requires_ach) {
                        return false;
                    }
                    return Givecloud.config.gateways[type];
                },
                submitLoginForm:function(event){
                    form = event.target;

                    if (!theme.bsFormValidate(form)) {
                        return;
                    }

                    var btn = Ladda.create(form.querySelector('button[type=submit]'));
                    var err = $(form).find('.alert-danger').hide();

                    var data = {
                        email    : $(form).find('input[name=email]').val(),
                        password : $(form).find('input[name=password]').val()
                    };

                    btn.start();

                    Givecloud.Account.login(data.email, data.password)
                        .bind(this)
                        .then(function(data) {
                            Givecloud.Cart(this.cart.id).get()
                                .bind(this)
                                .then(function(){
                                    theme.toast.success('Welcome back!');
                                })
                                .catch(function(err) {
                                    theme.toast.error(err);
                                }).finally(function(){
                                    btn.stop();
                                });
                        }).catch(function(err) {
                            theme.toast.error(err);
                            btn.stop();
                        });
                },
                submitCheckoutForm: function() {
                    var btn = Ladda.create(document.getElementById('btn-step-2-next'));
                    btn.start();

                    this.checkoutValidated = true;
                    this.$validator.validateAll('checkout')
                        .bind(this)
                        .then(function(valid) {
                            if (this.payment.number_type && !this.supportedCardType(this.payment.number_type)) {
                                return Promise.reject('Unsupport card type. Please try again with a different card.');
                            }
                            return valid && Givecloud.Cart(this.cart.id).checkout(this.input)
                                .bind(this)
                                .then(function() {
                                    if (this.input.password) {
                                        return Givecloud.Account.registerFromCart(this.cart.id, this.input.password);
                                    }
                                })
                                .then(function() {
                                    if (this.cart.requires_shipping && !this.cart.eligible_for_free_shipping) {
                                        this.step = 3;
                                    } else {
                                        this.step = 4;
                                    }
                                });
                        }).catch(function(err) {
                            theme.toast.error(err);
                        }).then(function(){
                            btn.stop();
                        });
                },
                submitShippingForm: function() {
                    var data = {
                        shipping_method_value: this.input.shipping_method_value
                    };

                    theme.ladda.start('#btn-step-3-next');

                    Givecloud.Cart(this.cart.id).update(data)
                        .bind(this)
                        .then(function(res) {
                            if (res.cart.requires_shipping && (res.cart.shipping_method || res.cart.eligible_for_free_shipping)) {
                                this.step = 4;
                            }
                        }).catch(function(err) {
                            theme.toast.error(err);
                        }).finally(function(){
                            theme.ladda.stop('#btn-step-3-next');
                        });
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
                        this.overlayTimer = setTimeout(arrow(this, function() {
                            this.overlayTimer = null;
                            modal.show();
                        }), 250);
                    }
                },
                validatePayForm: function() {
                    this.payValidated = true;
                    return this.$validator.validateAll('pay')
                        .then(function(valid) {
                            return valid ? Promise.resolve() : Promise.reject();
                        });
                },
                submitPayForm: function() {
                    this.validatePayForm()
                        .bind(this)
                        .then(function() {
                            this.paymentOverlay();
                            theme.ladda.start('#btn-pay');
                            if (this.input.referral_source != this.cart.referral_source) {
                                return Givecloud.Cart(this.cart.id).update({
                                    'referral_source': this.input.referral_source
                                });
                            }
                            return Promise.resolve();
                        }).then(function(res) {
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
                            setTimeout(arrow(this, function() {
                                window.location.href = '/order/' + this.cart.id + '/thank-you';
                            }),1000);
                        }).catch(function(err) {
                            if (err) {
                                if (theme.data_get(err, 'data.captcha')) {
                                    if (this.requiresCaptcha) {
                                        this.$refs.recaptcha.reset();
                                    } else {
                                        this.requiresCaptcha = true;
                                    }
                                }
                                theme.toast.error(err);
                            }
                            this.paymentOverlay('hide');
                            theme.ladda.stop('#btn-pay');
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

        Givecloud.Cart(this.cart_id).subscribe(this.update.bind(this));
    };

    CartComponent.prototype.update = function(cart) {
        if (!this.vm) {
            throw new Error("Cart has not been initialized yet.");
        }
        if (this.cart_id !== cart.id) {
            throw new Error("Unable to update carts not match.");
        }
        this.vm.cart = cart;
    };

    if (document.querySelectorAll('#cart-app').length) {
        return new CartComponent('#cart-app', Givecloud.config.cart_id);
    }

})();
