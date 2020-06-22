
theme.profile = (function(){

    function arrow(context, fn) {
        return fn.bind(context);
    }

    function data_get(data, property) {
        return Sugar.Object.get(data, property);
    }

    function ProfileComponent(selector) {
        this.selector = selector;

        function updateInput(account) {
            return {
                title:                   data_get(account, 'title'),
                first_name:              data_get(account, 'first_name'),
                last_name:               data_get(account, 'last_name'),
                organization_name:       data_get(account, 'organization_name'),
                email:                   data_get(account, 'email'),
                email_opt_in:            data_get(account, 'email_opt_in'),
                billing_title:           data_get(account, 'billing_address.title'),
                billing_first_name:      data_get(account, 'billing_address.first_name'),
                billing_last_name:       data_get(account, 'billing_address.last_name'),
                billing_email:           data_get(account, 'billing_address.email'),
                billing_address_01:      data_get(account, 'billing_address.address1'),
                billing_address_02:      data_get(account, 'billing_address.address2'),
                billing_company:         data_get(account, 'billing_address.company'),
                billing_city:            data_get(account, 'billing_address.city'),
                billing_province_code:   data_get(account, 'billing_address.province_code'),
                billing_zip:             data_get(account, 'billing_address.zip'),
                billing_country_code:    data_get(account, 'billing_address.country_code'),
                billing_phone:           data_get(account, 'billing_address.phone'),
                shipping_title:          data_get(account, 'shipping_address.title'),
                shipping_first_name:     data_get(account, 'shipping_address.first_name'),
                shipping_last_name:      data_get(account, 'shipping_address.last_name'),
                shipping_email:          data_get(account, 'shipping_address.email'),
                shipping_address_01:     data_get(account, 'shipping_address.address1'),
                shipping_address_02:     data_get(account, 'shipping_address.address2'),
                shipping_company:        data_get(account, 'shipping_address.company'),
                shipping_city:           data_get(account, 'shipping_address.city'),
                shipping_province_code:  data_get(account, 'shipping_address.province_code'),
                shipping_zip:            data_get(account, 'shipping_address.zip'),
                shipping_country_code:   data_get(account, 'shipping_address.country_code'),
                shipping_phone:          data_get(account, 'shipping_address.phone')
            };
        }

        this.vm = new Vue({
            el: this.selector,
            delimiters: ['${', '}'],
            data: {
                account: null,
                billing_province_label: 'State',
                shipping_province_label: 'State',
                input: updateInput(),
                credentials: {
                    password: null,
                    password_confirmation: null,
                },
                changePassword: false,
                formValidated: false,
                overlayTimer: null,
            },
            mounted: function () {
                this.account = JSON.parse(this.$el.attributes['account'].value);
            },
            watch: {
                account: function(account) {
                    this.input = updateInput(account);
                },
                'input.billing_country_code': function(new_value, old_value) {
                    if (new_value !== old_value) {
                        //this.input.billing_province_code = null;
                    }
                }
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
                editCredentials: function() {
                    this.changePassword = true;
                    this.$nextTick(theme.arrow(this, function() {
                        this.$refs.password.focus();
                    }));
                },
                cancelCredentials: function() {
                    this.changePassword = false;
                    this.credentials.password = null;
                    this.credentials.password_confirmation = null;
                },
                submitProfileForm: function(event) {
                    this.formValidated = true;
                    this.$validator.validateAll().bind(this).then(function(valid) {
                        if (valid) {
                            var data = this.input;
                            if (this.credentials.password || this.credentials.password_confirmation) {
                                data = Sugar.Object.add(data, this.credentials);
                            }

                            var btn = Ladda.create(document.querySelector('button[type=submit]'));
                            btn.start();

                            Givecloud.Account.update(data).bind(this)
                                .then(function() {
                                    theme.toast.success('Profile saved!');
                                }).catch(function(err) {
                                    theme.toast.error(err);
                                }).finally(function() {
                                    btn.stop();
                                });
                        }
                    });
                },
                copyBillingToShipping:function(event) {
                    this.input.shipping_title         = this.input.billing_title,
                    this.input.shipping_first_name    = this.input.billing_first_name,
                    this.input.shipping_last_name     = this.input.billing_last_name,
                    this.input.shipping_email         = this.input.billing_email,
                    this.input.shipping_address_01    = this.input.billing_address_01,
                    this.input.shipping_address_02    = this.input.billing_address_02,
                    this.input.shipping_company       = this.input.billing_company,
                    this.input.shipping_city          = this.input.billing_city,
                    this.input.shipping_province_code = this.input.billing_province_code,
                    this.input.shipping_zip           = this.input.billing_zip,
                    this.input.shipping_country_code  = this.input.billing_country_code,
                    this.input.shipping_phone         = this.input.billing_phone
                }
            }
        });
    }


    if (document.querySelectorAll('#profile-app').length) {
        return new ProfileComponent('#profile-app');
    }

})();
