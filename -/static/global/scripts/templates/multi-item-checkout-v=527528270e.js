theme.multiItemCheckout = (function (t) {

    function MultiItemCheckout(selector) {
        this.vm = new Vue({
            el: selector,
            delimiters: ['${', '}'],
            data: {
                pageId: null,
                isAddingItem: false,
                can_cover_costs: false,
                isPaymentProcessing: false,
                products: [],
                selectedProduct: { id: null },
                isLoadingCart: true,
                isUpdatingCart: false,
                cart: null,
                account: null,
                billing_province_label: 'State',
                input: {
                    account_type_id: 1,
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
                    is_anonymous: false,
                    comments: '',
                    cover_fees: false,
                },
                payment: {
                    currency: Givecloud.config.currency.code
                },
                payValidated: false,
                overlayTimer: null,
                promocode: null,
                requires_captcha: Givecloud.config.requires_captcha,
            },
            mounted: function () {
                var self = this;

                this.pageId = this.$el.attributes['page-id'].value;
                this.products = JSON.parse(this.$el.attributes['products'].value);
                this.can_cover_costs = parseInt(this.$el.attributes['can-cover-costs'].value, 0) ? true : false;

                if (this.products && this.products.length === 1) {
                    this.chooseProduct(this.products[0]);
                }

                $(document).on('gc-number-type', function (event) {
                    self.$set(self.payment, 'number_type', event.detail);
                });

                this.checkForExistingCart();
            },
            watch: {
                'input.payment_type': function (new_value, old_value) {
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
                'payment.number': function (new_value, old_value) {
                    if (new_value !== old_value) {
                        this.payment.number_type = Givecloud.CardholderData.getNumberType(new_value);
                    }
                },
                'payment.exp': function (new_value, old_value) {
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
                isSingleProduct: function () {
                    return this.products && (this.products.length === 1);
                },
                addingTicketTab: function () {
                    return this.selectedProduct.id ? 'fields' : 'product';
                },
                account_type: function () {
                    return this.account_types[this.input.account_type_id];
                },
                account_types: function () {
                    var types = {};
                    Givecloud.config.account_types.forEach(function (type) {
                        types[type.id] = type;
                    });
                    return types;
                },
                show_cover_costs: function () {
                    if (!this.can_cover_costs || !this.cart) {
                        return false;
                    }
                    return this.cart.line_items.filter(function (item) {
                        return item.cover_costs_enabled ? true : false;
                    }).length ? true : false;
                },
                config: function () {
                    return Givecloud.config;
                },
                donor_title_options: function () {
                    return Givecloud.config.title_options;
                },
                gateway: function () {
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
                billing_province_required: function () {
                    if (this.billing_subdivisions && Object.keys(this.billing_subdivisions).length) return 'required';
                },
                recurring_items: function () {
                    if (!this.cart) {
                        return [];
                    }
                    return this.cart.line_items.filter(function (item) {
                        return item.recurring_amount > 0;
                    });
                },
                recurring_amounts: function () {
                    var amounts = {
                        day: 0,
                        week: 0,
                        bimonthly: 0,
                        monthly: 0,
                        quarterly: 0,
                        biannually: 0,
                        annually: 0
                    };
                    this.recurring_items.forEach(function (item) {
                        amounts[item.recurring_frequency] += item.recurring_amount + item.cover_costs_recurring_amount;
                    });
                    return amounts;
                },
                unsupported_card_type: function() {
                    return this.payment.number_type && !this.supportedCardType(this.payment.number_type);
                },
            },
            asyncComputed: {
                countries: {
                    get: function () {
                        return Givecloud.Services.Locale.countries().then(function (data) {
                            delete data.countries['CA'];
                            delete data.countries['US'];
                            return Promise.resolve(data.countries);
                        });
                    },
                    default: {}
                },
                billing_subdivisions: {
                    get: function () {
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
                chooseProduct: function(product) {
                    this.selectedProduct = product;
                    Vue.nextTick(theme.arrow(this, function () {
                        theme.product.init(this.$el);
                    }));
                },
                openAddTicketDialog: function (e) {
                    e.preventDefault();
                    this.isAddingItem = true;
                },
                closeAddTicketModal: function () {
                    this.isAddingItem = false;
                },
                clearSelectedProduct: function () {
                    this.selectedProduct = { id: null };
                    theme.bsFormResetValidation(this.$refs.item_selection);
                    if (this.isSingleProduct) {
                        this.$nextTick(theme.arrow(this, function () {
                            this.chooseProduct(this.products[0]);
                        }));
                    }
                },
                getPercentageFees: function (amount) {
                    var fees = Givecloud.config.processing_fees;
                    return amount * (fees.rate / 100);
                },
                getPerTransactionFee: function () {
                    return Givecloud.config.processing_fees.amount;
                },
                onAddToCart: function () {
                    var $form = $('#item-selection'),
                        submit_btn = Ladda.create($form.find('button[name=add-item]:visible')[0]),
                        back_button = $form.find('button[name=back-button]:visible'),
                        data = { form_fields: {} };

                    // validate form
                    if (theme.bsFormValidate($form[0]) === false) {
                        return;
                    }

                    submit_btn.start();
                    back_button.slideUp();

                    this.ensureCart()
                        .bind(this)
                        .then(function () {
                            $.each($form.gc_serializeArray(), function (i, k) {
                                theme.data_set(data, k.name, k.value);
                            });
                            return Givecloud.Cart(this.cart.id).addProduct(data);
                        }).then(function(result) {
                            this.cart = result.cart;
                            this.closeAddTicketModal();
                            this.clearSelectedProduct();
                        }).catch(function(err) {
                            theme.toast.error(err);
                        }).finally(function () {
                            submit_btn.stop();
                            back_button.slideDown();
                        })
                },
                ensureCart: function () {
                    if (this.cart) {
                        return Promise.resolve();
                    }
                    return this.checkForExistingCart().bind(this).then(function () {
                        if (!this.cart) {
                            return this.createNewCart();
                        }
                        return Promise.resolve()
                    });
                },
                checkForExistingCart: function () {
                    var storedCartId = sessionStorage.getItem('multi-item-cart-' + this.pageId);
                    if (storedCartId) {
                        this.isLoadingCart = true;
                        return Givecloud.Cart(storedCartId).get().bind(this).then(function (cart) {
                            this.cart = cart;
                            console.log(cart);
                        }).finally(function () {
                            this.isLoadingCart = false;
                            return Promise.resolve();
                        });
                    }
                    this.isLoadingCart = false;
                    return Promise.resolve();
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
                createNewCart: function () {
                    return Givecloud.Cart.create().bind(this).then(function (result) {
                        this.cart = result.cart;
                        sessionStorage.setItem('multi-item-cart-' + this.pageId, this.cart.id);
                        return Promise.resolve();
                    });
                },
                removeItem: function (event, item) {
                    var btn = Ladda.create(event.target);
                    btn.start();
                    return Givecloud.Cart(this.cart.id).removeItem(item.id).bind(this).then(function (result) {
                        this.cart = result.cart;
                    }).catch(function (err) {
                        theme.toast.error(err);
                        btn.stop();
                    });
                },
                supportedCardType: function (type) {
                    return Givecloud.config.supported_cardtypes.indexOf(type) !== -1;
                },
                supportedPaymentType: function (type) {
                    if (type !== 'bank_account' && t.data_get(this.cart, 'requires_ach')) {
                        return false;
                    }
                    return Givecloud.config.gateways[type];
                },
                paymentExpiry: function (event) {
                    if (event.isTrusted && event.target === document.activeElement) {
                        setTimeout(function () {
                            var position = event.target.value.length;
                            event.target.setSelectionRange(position, position);
                        }, 60);
                    }
                },
                paymentOverlay: function (status) {
                    $modal = $('#payment-overlay');
                    if (status === 'hide') {
                        this.isPaymentProcessing = false;
                    } else {
                        this.isPaymentProcessing = true;
                        $modal.find('.spinner').addClass('d-none');
                        if (status === 'success') {
                            $modal.find('.spinner-success').removeClass('d-none');
                        } else {
                            $modal.find('.spinner-spin').removeClass('d-none');
                        }
                    }
                },
                validatePayForm: function (showErrors) {
                    if (showErrors === void 0 || showErrors) {
                        this.payValidated = true;
                    }
                    return this.$validator.validateAll('pay')
                        .bind(this)
                        .then(function (valid) {
                            if (this.payment.number_type && !this.supportedCardType(this.payment.number_type)) {
                                return Promise.reject('Unsupport card type. Please try again with a different card.');
                            }
                            if (!valid || t.bsFormValidate(this.$refs.form) === false) {
                                t.scrollIntoView(this.$el.querySelector('.has-errors'), 85).then(function (element) {
                                    element.find(':input').focus();
                                });
                                return Promise.reject();
                            } else {
                                return Promise.resolve();
                            }
                        });
                },
                submitPayForm: function () {
                    // look at cart.js for a better example
                    this.validatePayForm()
                        .bind(this)
                        .then(function () {
                            this.paymentOverlay();
                            theme.ladda.start('#btn-pay');
                            return Givecloud.Cart(this.cart.id).updateCheckout(this.input).bind(this).then(function (data) {
                                if (this.cart.requires_payment) {
                                    this.cart = data.cart;
                                    this.payment.name = this.cart.billing_address.name;
                                    this.payment.email = this.cart.billing_address.email;
                                    this.payment.company = this.cart.billing_address.company;
                                    this.payment.address_line1 = this.cart.billing_address.address1;
                                    this.payment.address_line2 = this.cart.billing_address.address2;
                                    this.payment.address_city = this.cart.billing_address.city;
                                    this.payment.address_state = this.cart.billing_address.province_code;
                                    this.payment.address_zip = this.cart.billing_address.zip;
                                    this.payment.address_country = this.cart.billing_address.country_code;
                                    return this.gateway.getCaptureToken(this.cart, this.payment, this.input.payment_type, this.input.recaptcha_response, this.payment.save_payment_method)
                                        .bind(this)
                                        .then(function (token) {
                                            return this.gateway.chargeCaptureToken(this.cart, token);
                                        });
                                }
                                return Givecloud.Cart(this.cart.id).complete();
                            });
                        }).then(function (res) {
                            this.paymentOverlay('success');
                            sessionStorage.removeItem('multi-item-cart-' + this.pageId);
                            setTimeout(t.arrow(this, function () {
                                window.location.href = '/order/' + this.cart.id + '/thank-you';
                            }), 1000);
                        }).catch(function (err) {
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
                },
                applyPromo: function () {
                    Givecloud.Cart(this.cart.id).addDiscount(this.promocode).bind(this)
                        .then(function (result) {
                            this.cart = result.cart;
                            theme.toast.success('Discount applied!');
                        })
                        .catch(function () {
                            theme.toast.error('Error applying discount.');
                        });
                }
            },
            filters: {
                money: function (value) {
                    return Givecloud.config.currency.symbol + theme.formatNumber(value);
                },
                ordinal: function (value) {
                    value = parseInt(value);
                    if (value) {
                        return Sugar.Number.ordinalize(value);
                    }
                },
                size: function (value) {
                    return Sugar.Object.size(value);
                }
            }
        });

        if (Givecloud.config.account_id) {
            Givecloud.Account.get().then(t.arrow(this.vm, function (data) {
                // this needs to happen in the next tick to avoid validation issues
                // https://github.com/baianat/vee-validate/issues/2109
                this.$nextTick(t.arrow(this, function() {
                    this.account = data.account;
                    if (data.account.payment_methods.length) {
                        this.input.payment_type = 'payment_method'
                    }
                }));

                this.input.billing_title = t.data_get(data.account, 'billing_address.title');
                this.input.billing_first_name = t.data_get(data.account, 'billing_address.first_name', t.data_get(data.account, 'first_name'));
                this.input.billing_last_name = t.data_get(data.account, 'billing_address.last_name', t.data_get(data.account, 'last_name'));
                this.input.billing_email = t.data_get(data.account, 'billing_address.email', t.data_get(data.account, 'email'));
                this.input.billing_address1 = t.data_get(data.account, 'billing_address.address1');
                this.input.billing_address2 = t.data_get(data.account, 'billing_address.address2');
                this.input.billing_company = t.data_get(data.account, 'billing_address.company');
                this.input.billing_city = t.data_get(data.account, 'billing_address.city');
                this.input.billing_province_code = t.data_get(data.account, 'billing_address.province_code');
                this.input.billing_country_code = t.data_get(data.account, 'billing_address.country_code', Givecloud.config.billing_country_code);
                this.input.billing_zip = t.data_get(data.account, 'billing_address.zip');
                this.input.billing_phone = t.data_get(data.account, 'billing_address.phone');
            })).catch(t.noop);
        }
    }

    if (document.querySelectorAll('#multi-item-checkout-app').length) {
        return new MultiItemCheckout('#multi-item-checkout-app');
    }

})(theme);
