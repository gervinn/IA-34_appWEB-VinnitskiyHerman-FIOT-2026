const User = require("./User");
const Post = require("./Post");

User.hasMany(Post, {
  foreignKey: "user_id",
  as: "posts",
  onDelete: "CASCADE",
});

Post.belongsTo(User, {
  foreignKey: "user_id",
  as: "author",
});

module.exports = {
  User,
  Post,
};