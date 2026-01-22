/**
 * Success Response Helper
 */
class ApiResponse {
  static success(res, data, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data
    });
  }

  static created(res, data, message = 'Resource created successfully') {
    return res.status(201).json({
      success: true,
      statusCode: 201,
      message,
      data
    });
  }

  static noContent(res, message = 'Resource deleted successfully') {
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message
    });
  }

  static paginate(res, data, pagination, message = 'Success') {
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message,
      data,
      pagination
    });
  }
}

module.exports = ApiResponse;
