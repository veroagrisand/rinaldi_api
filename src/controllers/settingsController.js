const { getConnection } = require('../config/database');
const { ApiError, catchAsync } = require('../utils/errorHandler');
const ApiResponse = require('../utils/response');
const { convertBigInt, sanitizeInput } = require('../utils/helpers');
const { validateRequired } = require('../utils/validation');

exports.getSettings = catchAsync(async (req, res, next) => {
  const conn = await getConnection();

  try {
    const settings = await conn.query('SELECT * FROM settings LIMIT 1');

    if (settings.length === 0) {
      throw new ApiError(404, 'Settings not found');
    }

    return ApiResponse. success(res, convertBigInt(settings[0]), 'Settings retrieved successfully');

  } finally {
    if (conn) conn.release();
  }
});

exports.updateSettings = catchAsync(async (req, res, next) => {
  const {
    website_name, website_title, logo, favicon, favicon_text,
    taxvoice, description, email, whatsapp, instagram,
    facebook, youtube, twitter, telegram
  } = req.body;

  validateRequired(req.body, ['website_name', 'website_title']);

  const sanitizedData = {
    website_name: sanitizeInput(website_name),
    website_title: sanitizeInput(website_title),
    logo: logo ? sanitizeInput(logo) : null,
    favicon: favicon ? sanitizeInput(favicon) : null,
    favicon_text:  favicon_text ?  sanitizeInput(favicon_text) : null,
    taxvoice: taxvoice ?  sanitizeInput(taxvoice) : null,
    description: description ? sanitizeInput(description) : null,
    email: email ?  sanitizeInput(email) : null,
    whatsapp: whatsapp ? sanitizeInput(whatsapp) : null,
    instagram: instagram ? sanitizeInput(instagram) : null,
    facebook: facebook ? sanitizeInput(facebook) : null,
    youtube:  youtube ? sanitizeInput(youtube) : null,
    twitter: twitter ? sanitizeInput(twitter) : null,
    telegram: telegram ?  sanitizeInput(telegram) : null
  };

  const conn = await getConnection();

  try {
    const settings = await conn. query('SELECT id FROM settings LIMIT 1');

    if (settings.length === 0) {
      const result = await conn.query(
        `INSERT INTO settings (website_name, website_title, logo, favicon, favicon_text, taxvoice, description, 
         email, whatsapp, instagram, facebook, youtube, twitter, telegram) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sanitizedData.website_name, sanitizedData.website_title, sanitizedData.logo,
          sanitizedData.favicon, sanitizedData.favicon_text, sanitizedData.taxvoice,
          sanitizedData.description, sanitizedData.email, sanitizedData. whatsapp,
          sanitizedData.instagram, sanitizedData. facebook, sanitizedData.youtube,
          sanitizedData.twitter, sanitizedData.telegram
        ]
      );

      return ApiResponse.created(res, {
        id: Number(result.insertId),
        ...sanitizedData
      }, 'Settings created successfully');
    } else {
      await conn.query(
        `UPDATE settings SET website_name = ?, website_title = ?, logo = ?, favicon = ?, favicon_text = ?, 
         taxvoice = ?, description = ?, email = ?, whatsapp = ?, instagram = ?, facebook = ?, 
         youtube = ?, twitter = ?, telegram = ? 
         WHERE id = ?`,
        [
          sanitizedData. website_name, sanitizedData. website_title, sanitizedData. logo,
          sanitizedData. favicon, sanitizedData.favicon_text, sanitizedData.taxvoice,
          sanitizedData. description, sanitizedData.email, sanitizedData.whatsapp,
          sanitizedData.instagram, sanitizedData.facebook, sanitizedData.youtube,
          sanitizedData.twitter, sanitizedData. telegram, settings[0].id
        ]
      );

      return ApiResponse. success(res, null, 'Settings updated successfully');
    }

  } finally {
    if (conn) conn.release();
  }
});
