const { DataTypes } = require("sequelize");
const sequelize = require("../config/sequelize");

const Post = sequelize.define(
  "Post",
  {
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "posts",
    timestamps: false,
  }
);

module.exports = Post;