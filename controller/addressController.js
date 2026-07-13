const Address = require('../model/Address');
const { log } = require('../utils/logger');

exports.getAddresses = async (req, res) => {
  try {
    const addresses = await Address.findAll({ where: { userId: req.user.id } });
    res.status(200).json(addresses);
  } catch (error) {
    log("Error in getAddresses: " + error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.addAddress = async (req, res) => {
  try {
    const { isDefault } = req.body;
    
    if (isDefault) {
      await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
    }

    const address = await Address.create({
      ...req.body,
      userId: req.user.id
    });
    res.status(201).json(address);
  } catch (error) {
    log("Error in addAddress: " + error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const { isDefault } = req.body;

    if (isDefault) {
      await Address.update({ isDefault: false }, { where: { userId: req.user.id } });
    }

    const [updated] = await Address.update(req.body, {
      where: { id, userId: req.user.id }
    });

    if (updated) {
      const updatedAddress = await Address.findByPk(id);
      return res.status(200).json(updatedAddress);
    }
    throw new Error('Address not found');
  } catch (error) {
    log("Error in updateAddress: " + error.message);
    res.status(500).json({ message: error.message });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Address.destroy({
      where: { id, userId: req.user.id }
    });
    if (deleted) {
      return res.status(204).send();
    }
    throw new Error('Address not found');
  } catch (error) {
    log("Error in deleteAddress: " + error.message);
    res.status(500).json({ message: error.message });
  }
};
