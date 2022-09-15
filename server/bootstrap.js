'use strict';

const { getAbsoluteAdminUrl } = require('@strapi/utils');

const initEmails = async (pluginStore) => {
  const value = await pluginStore.get({ key: 'email' }) || {};
  value.send_magic_link_invite = {
    display: 'Email.template.send_magic_link_invite',
    icon: 'magic',
    options: {
      from: {
        name: 'Administration Panel',
        email: 'no-reply@strapi.io',
      },
      response_email: '',
      object: "You've been invited to a new workspace",
      message: `<p>Hi <%= USER.firstname %>!</p>

<p>You've been invited to a workspace. Please click on the link below to create your account.</p>

<p><%= URL %></p>

<p>Thanks.</p>`,
    },
  }

  await pluginStore.set({ key: 'email', value });
};

module.exports = async ({ strapi }) => {
  const pluginStore = strapi.store({ type: 'plugin', name: 'users-permissions' });
  await initEmails(pluginStore);

  // bootstrap phase
  strapi.db.lifecycles.subscribe({
    models: ['admin::user'],
  
    async afterCreate({ result }) {
      const { registrationToken } = result;
      if (!registrationToken) return;
      
      const emailSettings = strapi.plugin('email').service('email').getProviderSettings();
      const defaultFrom = emailSettings?.settings?.defaultFrom  || 'Strapi <no-reply@strapi.io>';
      const defaultReplyTo = emailSettings?.settings?.defaultReplyTo || 'Strapi <no-reply@strapi.io>'; 
      const userPermissionService = strapi.plugin('users-permissions').service('users-permissions')
      const inviteLink = `${getAbsoluteAdminUrl(strapi.config)}/auth/register?registrationToken=${registrationToken}`;

      const settings = await pluginStore
        .get({ key: 'email' })
        .then((storeEmail) => storeEmail.send_magic_link_invite.options);

      settings.message = await userPermissionService.template(settings.message, {
        URL: inviteLink,
        USER: result,
      });   

      strapi
        .plugin('email')
        .service('email')
        .send({
          to: result.email,
          from: defaultFrom,
          replyTo: defaultReplyTo,
          subject: settings.object,
          text: settings.message,
          html: settings.message,
        })
        .catch((err) => {
          strapi.log.error(err);
        });
    },
  });
};``
