const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const User = sequelize.define(
  "User",
  {
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
    },

    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    role: {
      type: DataTypes.STRING(50),
      defaultValue: "user",
    },

    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    emailConfirmed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    emailConfirmToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    resetPasswordToken: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    resetPasswordExpires: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    googleId: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    loginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },

    lockUntil: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "users",
    timestamps: false,
  }
);

module.exports = User;